import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import formidable from 'formidable';
import { Unzip, UnzipInflate } from 'fflate';
import pdfParse from 'pdf-parse';
import { createServerSupabase, getRequestUser } from '../../../lib/serverTests';
import { normalizeTetSection } from '../../../lib/tetSections';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 300_000;
const MAX_QUESTIONS = 200;
const MAX_DOCX_XML_SIZE = 5 * 1024 * 1024;
const MAX_PARSER_OUTPUT = 5 * 1024 * 1024;

export const config = {
  api: { bodyParser: false },
};

function parseUpload(req) {
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(files.document);
    });
  });
}

function getFileExtension(file) {
  const name = file.originalFilename || '';
  return name.slice(name.lastIndexOf('.')).toLowerCase();
}

async function extractDocxText(fileBuffer) {
  let documentXmlPromise;
  let foundDocumentXml = false;
  const unzip = new Unzip((file) => {
    if (file.name !== 'word/document.xml') {
      file.terminate();
      return;
    }

    foundDocumentXml = true;
    documentXmlPromise = new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      file.ondata = (error, chunk, final) => {
        if (error) {
          reject(error);
          return;
        }
        size += chunk.length;
        if (size > MAX_DOCX_XML_SIZE) {
          file.terminate();
          reject(new Error('The Word document expands beyond the supported size.'));
          return;
        }
        chunks.push(Buffer.from(chunk));
        if (final) resolve(Buffer.concat(chunks).toString('utf8'));
      };
    });
    file.start();
  });
  unzip.register(UnzipInflate);

  try {
    unzip.push(fileBuffer, true);
  } catch (error) {
    throw new Error(`The Word document could not be read: ${error.message}`);
  }
  if (!foundDocumentXml || !documentXmlPromise) {
    throw new Error('The Word document does not contain readable document text.');
  }

  const xml = await documentXmlPromise;
  const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  return paragraphs.map((paragraph) => paragraph.replace(
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<w:cr\b[^>]*\/?>/g,
    (element, text) => {
      if (text !== undefined) {
        return text.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|[0-9]+);/gi, (entity) => {
          const namedEntities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
          if (Object.hasOwn(namedEntities, entity)) return namedEntities[entity];
          const codePoint = entity[2].toLowerCase() === 'x'
            ? Number.parseInt(entity.slice(3, -1), 16)
            : Number.parseInt(entity.slice(2, -1), 10);
          return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
        });
      }
      return element.startsWith('<w:tab') ? '\t' : '\n';
    },
  ).trim()).filter(Boolean).join('\n');
}

function parseWithPython(documentText) {
  return new Promise((resolve, reject) => {
    const parserPath = path.join(process.cwd(), 'pages', 'api', 'admin', 'question_parser.py');
    const parser = spawn(process.env.PYTHON || 'python3', [parserPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errorOutput = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result);
    };
    const timeout = setTimeout(() => {
      parser.kill();
      finish(new Error('The question parser timed out. Try a smaller document.'));
    }, 30_000);

    parser.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > MAX_PARSER_OUTPUT) {
        parser.kill();
        finish(new Error('The parsed question data exceeds the supported size.'));
      }
    });
    parser.stderr.on('data', (chunk) => {
      errorOutput = `${errorOutput}${chunk.toString()}`.slice(-4000);
    });
    parser.on('error', (error) => {
      if (error.code === 'ENOENT') {
        const runtimeError = new Error('Python 3 is required for question import. Install Python 3 or set the PYTHON server environment variable.');
        runtimeError.httpCode = 503;
        finish(runtimeError);
        return;
      }
      finish(error);
    });
    parser.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`The question parser failed${errorOutput ? `: ${errorOutput.trim()}` : '.'}`));
        return;
      }
      try {
        finish(null, JSON.parse(output));
      } catch {
        finish(new Error('The question parser returned invalid data.'));
      }
    });
    parser.stdin.on('error', (error) => finish(error));
    parser.stdin.end(JSON.stringify({ text: documentText }));
  });
}

function normalizeOption(option, index) {
  const label = String.fromCharCode(65 + index);
  return option.trim()
    .replace(new RegExp(`^(?:\\(${label}\\)|${label}[.)\\]:-])\\s*`, 'i'), '')
    .trim();
}

function validateQuestions(payload, isTetDocument) {
  if (!payload || !Array.isArray(payload.questions) || payload.questions.length === 0) {
    throw new Error('No complete multiple-choice questions were found. Check that the document uses numbered questions and A-D option labels.');
  }
  if (payload.questions.length > MAX_QUESTIONS) {
    throw new Error(`The document produced more than ${MAX_QUESTIONS} questions. Split it into smaller files and upload each part separately.`);
  }

  const questions = [];
  const skippedQuestionNumbers = [];
  payload.questions.forEach((question, index) => {
    const options = question && typeof question === 'object' ? question.options : null;
    const cleanedOptions = Array.isArray(options)
      ? options.map((option, optionIndex) => (
        typeof option === 'string' ? normalizeOption(option, optionIndex) : option
      ))
      : null;
    const answerText = String(question?.correct_option || '').trim().toLowerCase();
    const answerMatch = answerText.match(/^(?:(?:option|choice|answer)\s*)?[:.)-]?\s*([a-d])(?:\b|$)/i);
    const correctOption = answerMatch?.[1]?.toLowerCase() || '';
    const sourceSection = typeof question?.section === 'string' ? question.section.trim() : '';
    const section = isTetDocument ? normalizeTetSection(sourceSection) : sourceSection;
    const questionText = typeof question?.question_text === 'string' ? question.question_text.trim() : '';
    const explanation = typeof question?.explanation === 'string' ? question.explanation.trim() : '';
    const isValid = section
      && section.length <= 80
      && questionText
      && questionText.length <= 3000
      && Array.isArray(cleanedOptions)
      && cleanedOptions.length === 4
      && cleanedOptions.every((option) => typeof option === 'string' && option && option.length <= 1000)
      && explanation.length <= 5000;

    if (!isValid) {
      skippedQuestionNumbers.push(index + 1);
      return;
    }

    questions.push({
      section,
      question_text: questionText,
      options: cleanedOptions,
      correct_option: correctOption,
      marks: 1,
      explanation,
    });
  });

  if (!questions.length) {
    throw new Error('No complete questions with four options were found. Check that the document contains readable questions and choices.');
  }

  return {
    title: typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '',
    questions,
    skippedQuestionNumbers,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let uploadedFilePath;
  try {
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { data: admin, error: adminError } = await supabase
      .from('exam_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminError) return res.status(500).json({ error: `Administrator access could not be checked: ${adminError.message}` });
    if (!admin) return res.status(403).json({ error: 'Only administrators can parse questions.' });

    const parsedFile = await parseUpload(req);
    const file = Array.isArray(parsedFile) ? parsedFile[0] : parsedFile;
    if (!file) return res.status(400).json({ error: 'Choose a PDF or Word document to upload.' });
    uploadedFilePath = file.filepath;
    const extension = getFileExtension(file);
    if (!['.pdf', '.docx'].includes(extension)) {
      return res.status(400).json({ error: 'Upload a PDF or modern Word document (.docx). Older .doc files are not supported.' });
    }

    const fileBuffer = await readFile(file.filepath);
    const documentText = (extension === '.pdf'
      ? (await pdfParse(fileBuffer)).text
      : await extractDocxText(fileBuffer)).trim();
    if (!documentText) {
      return res.status(400).json({ error: 'No readable text was found. Scanned PDFs need OCR before they can be imported.' });
    }
    if (documentText.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: `The document contains more than ${MAX_TEXT_LENGTH.toLocaleString()} characters of text. Split it into smaller files before uploading.` });
    }

    const isTetDocument = /\btet\b|teacher eligibility test/i.test(
      `${file.originalFilename || ''}\n${documentText.slice(0, 5000)}`,
    );
    const parsedQuestions = await parseWithPython(documentText);
    if (!parsedQuestions || !Array.isArray(parsedQuestions.questions)) {
      throw new Error('The question parser returned an invalid question list.');
    }
    const title = path.basename(file.originalFilename || 'Uploaded document')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    try {
      const extractedQuestions = validateQuestions({ title, questions: parsedQuestions.questions }, isTetDocument);
      const { skippedQuestionNumbers: validationSkipped, ...validQuestions } = extractedQuestions;
      return res.status(200).json({
        ...validQuestions,
        skippedQuestionNumbers: [
          ...(parsedQuestions.skippedQuestionNumbers || []),
          ...validationSkipped,
        ],
      });
    } catch (validationError) {
      return res.status(422).json({ error: validationError.message });
    }
  } catch (error) {
    const statusCode = error.httpCode || 500;
    const message = error.code === 1016 || error.code === 1009
      ? 'The file exceeds the 10 MB upload limit.'
      : error.message || 'The document could not be processed.';
    return res.status(statusCode).json({ error: message });
  } finally {
    if (uploadedFilePath) {
      await unlink(uploadedFilePath).catch((cleanupError) => {
        console.error('Could not remove temporary question-import upload:', cleanupError.message);
      });
    }
  }
}
