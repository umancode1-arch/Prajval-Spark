import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthForm from '../components/AuthForm';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const blankQuestion = () => ({
  section: 'General Awareness',
  sectionDraft: null,
  question_text: '',
  options: ['', '', '', ''],
  correct_option: 'a',
  marks: 1,
  explanation: '',
});

const levelChoices = ['10th Pass', '12th Pass', 'Graduate'];
const sectionChoices = ['Quantitative Aptitude', 'Reasoning', 'General Awareness', 'English', 'Science'];
const addSectionHeadingOption = '__add_section_heading__';
const removableMockTitle = 'AP SPECIAL TET 2026 (SET 1)';

function hasIncompleteQuestionDraft(questions) {
  return !questions.length || questions.some((question) => (
    typeof question.sectionDraft === 'string'
    || !question.question_text.trim()
    || question.options.some((option) => !option.trim())
    || !question.explanation.trim()
  ));
}

function createQuestionRows(testId, questions, startIndex = 0) {
  return questions.map((question, index) => ({
    test_id: testId,
    section: question.section,
    question_text: question.question_text.trim(),
    option_a: question.options[0].trim(),
    option_b: question.options[1].trim(),
    option_c: question.options[2].trim(),
    option_d: question.options[3].trim(),
    correct_option: question.correct_option,
    marks: Number(question.marks),
    explanation: question.explanation.trim(),
    order_index: startIndex + index,
  }));
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [tests, setTests] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(levelChoices[0]);
  const [duration, setDuration] = useState(30);
  const [isFree, setIsFree] = useState(true);
  const [bundleId, setBundleId] = useState('');
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [existingTestId, setExistingTestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAuthorized, setUploadAuthorized] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminContent = useCallback(async () => {
    const [testResult, bundleResult] = await Promise.all([
      supabase.from('tests').select('id,title,description,level,is_free,duration_minutes,created_at,bundle_id,bundles(name)').order('created_at', { ascending: false }),
      supabase.from('bundles').select('id,name').order('name'),
    ]);
    if (testResult.error) setError(`Question papers could not be loaded: ${testResult.error.message}`);
    else setTests(testResult.data || []);
    if (!bundleResult.error) setBundles(bundleResult.data || []);
  }, []);

  const verifyAdmin = useCallback(async (user) => {
    setCheckingAdmin(true);
    setError('');
    const { data, error: roleError } = await supabase
      .from('exam_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    setCheckingAdmin(false);
    if (roleError) {
      throw new Error(`Admin access could not be checked. Apply the Supabase setup in supabase-schema.sql first. ${roleError.message}`);
    }
    if (!data) throw new Error('This verified email is not on the administrator list. Ask an existing project owner to provision it in Supabase.');
    setAdmin(user);
    await loadAdminContent();
  }, [loadAdminContent]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(`Your session could not be checked: ${sessionError.message}`);
      if (data.session?.user) {
        try {
          await verifyAdmin(data.session.user);
        } catch (roleError) {
          if (active) setError(roleError.message);
        }
      }
      if (active) setAuthReady(true);
    });
    return () => { active = false; };
  }, [verifyAdmin]);

  const changeQuestion = (index, changes) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...changes } : question
    )));
  };

  const changeOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const selectExistingTest = (testId) => {
    setExistingTestId(testId);
    const selectedTest = tests.find((test) => test.id === testId);
    if (!selectedTest) {
      setTitle('');
      setDescription('');
      setDuration(30);
      setLevel(levelChoices[0]);
      setIsFree(true);
      setBundleId('');
      return;
    }

    setTitle(selectedTest.title);
    setDescription(selectedTest.description || '');
    setDuration(selectedTest.duration_minutes);
    setLevel(selectedTest.level);
    setIsFree(selectedTest.is_free);
    setBundleId(selectedTest.bundle_id || '');
  };

  const extractQuestions = async () => {
    setError('');
    setNotice('');
    if (!uploadFile) {
      setError('Choose a PDF or .docx file first.');
      return;
    }
    if (!uploadAuthorized) {
      setError('Confirm that you have permission to use the uploaded document before extracting its questions.');
      return;
    }

    setExtracting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error(sessionError?.message || 'Your sign-in expired. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('document', uploadFile);
      const response = await fetch('/api/admin/extract-questions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: formData,
      });
      const responseText = await response.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        const detail = responseText.trimStart().startsWith('<')
          ? `The server returned an HTML error page (HTTP ${response.status}). Restart the development server and try again.`
          : `The server returned an unreadable response (HTTP ${response.status}).`;
        throw new Error(detail);
      }
      if (!response.ok) throw new Error(payload.error || 'Questions could not be extracted.');

      const importedQuestions = payload.questions.map((question) => ({
        ...question,
        marks: 1,
      }));
      setQuestions(importedQuestions);
      setTitle((current) => current.trim() || payload.title || uploadFile.name.replace(/\.[^.]+$/, ''));
      const inferredCount = importedQuestions.filter((question) => question.answer_source === 'inferred').length;
      setNotice(
        `${importedQuestions.length} question${importedQuestions.length === 1 ? '' : 's'} extracted. Review every question and correct answer before publishing.`
        + (payload.skippedQuestionNumbers?.length
          ? ` Skipped ${payload.skippedQuestionNumbers.length} incomplete item${payload.skippedQuestionNumbers.length === 1 ? '' : 's'} from the extraction (items ${payload.skippedQuestionNumbers.join(', ')}); check the source document and add those questions manually if needed.`
          : '')
        + (inferredCount ? ` ${inferredCount} answer${inferredCount === 1 ? ' was' : 's were'} inferred because the document did not provide an answer key.` : '')
      );
    } catch (extractError) {
      setError(extractError.message);
    } finally {
      setExtracting(false);
    }
  };

  const createQuestionPaper = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (hasIncompleteQuestionDraft(questions)) {
      setError('Finish any new section heading, then complete each question, all four options, and its solution before publishing.');
      return;
    }
    if (!isFree && !bundleId) {
      setError('Choose a bundle for a premium question paper.');
      return;
    }

    setBusy(true);
    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert({
        title: title.trim(),
        description: description.trim(),
        level,
        is_free: isFree,
        bundle_id: isFree ? null : bundleId,
        duration_minutes: Number(duration),
      })
      .select('id')
      .single();

    if (testError) {
      setBusy(false);
      setError(`The question paper could not be created: ${testError.message}`);
      return;
    }

    const questionRows = createQuestionRows(test.id, questions);
    const { error: questionError } = await supabase.from('questions').insert(questionRows);
    if (questionError) {
      const { error: rollbackError } = await supabase.from('tests').delete().eq('id', test.id);
      setBusy(false);
      setError(
        `The paper was created but its questions could not be saved: ${questionError.message}`
        + (rollbackError ? ` The empty paper could not be removed: ${rollbackError.message}` : '')
      );
      return;
    }

    setBusy(false);
    setTitle('');
    setDescription('');
    setDuration(30);
    setLevel(levelChoices[0]);
    setIsFree(true);
    setBundleId('');
    setQuestions([blankQuestion()]);
    setNotice('Question paper published. It is now available in the matching dashboard test list.');
    await loadAdminContent();
  };

  const addQuestionsToExistingTest = async () => {
    setError('');
    setNotice('');
    if (!existingTestId) {
      setError('Choose an existing mock before adding questions.');
      return;
    }
    if (hasIncompleteQuestionDraft(questions)) {
      setError('Finish any new section heading, then complete each question, all four options, and its solution before adding questions.');
      return;
    }

    const selectedTest = tests.find((test) => test.id === existingTestId);
    if (!selectedTest) {
      setError('The selected mock is no longer available. Reload the page and choose it again.');
      return;
    }

    setBusy(true);
    const { data: lastQuestion, error: orderError } = await supabase
      .from('questions')
      .select('order_index')
      .eq('test_id', selectedTest.id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      setBusy(false);
      setError(`The existing questions could not be checked: ${orderError.message}`);
      return;
    }

    const nextOrderIndex = (lastQuestion?.order_index ?? -1) + 1;
    const { error: questionError } = await supabase
      .from('questions')
      .insert(createQuestionRows(selectedTest.id, questions, nextOrderIndex));

    setBusy(false);
    if (questionError) {
      setError(`Questions could not be added to ${selectedTest.title}: ${questionError.message}`);
      return;
    }

    const addedCount = questions.length;
    setQuestions([blankQuestion()]);
    setNotice(`${addedCount} question${addedCount === 1 ? '' : 's'} added to ${selectedTest.title}.`);
  };

  const deleteSelectedMock = async () => {
    setError('');
    setNotice('');
    const selectedTest = tests.find((test) => test.id === existingTestId);
    if (!selectedTest || !selectedTest.is_free || selectedTest.title !== removableMockTitle) {
      setError(`Select the free mock "${removableMockTitle}" before deleting it.`);
      return;
    }
    if (!window.confirm(`Permanently delete "${selectedTest.title}" and all its questions? This cannot be undone.`)) return;

    setBusy(true);
    const { data: deletedTest, error: deleteError } = await supabase
      .from('tests')
      .delete()
      .eq('id', selectedTest.id)
      .eq('title', removableMockTitle)
      .eq('is_free', true)
      .select('id')
      .maybeSingle();

    setBusy(false);
    if (deleteError) {
      setError(`The mock could not be deleted: ${deleteError.message}. If students have attempts for this mock, preserve those records and resolve the references before deleting.`);
      return;
    }
    if (!deletedTest) {
      setError('The mock was not deleted. It may no longer exist or your administrator session may have expired.');
      return;
    }

    setQuestions([blankQuestion()]);
    selectExistingTest('');
    setNotice(`"${selectedTest.title}" and its questions were deleted.`);
    await loadAdminContent();
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Sign out failed: ${signOutError.message}`);
    else setAdmin(null);
  };

  if (!isSupabaseConfigured) {
    return <main className="page-wrap"><div className="inline-alert">Admin sign-in requires a configured Supabase project.</div><Link href="/" className="button button-ghost">Back to dashboard</Link></main>;
  }

  if (!authReady || checkingAdmin) {
    return <main className="page-wrap"><div className="empty-state">Checking administrator access…</div></main>;
  }

  if (!admin) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
          <div className="auth-visual-copy"><div className="eyebrow">ADMIN WORKSPACE</div><h2>Build the next great practice paper.</h2><p>Sign in with a verified email that has been provisioned as an exam administrator.</p></div>
          <div className="auth-perks"><span>✓ Add level-based papers</span><span>✓ Write complete solutions</span><span>✓ Review test series</span></div>
        </section>
        <section className="auth-panel-wrap">
          <div>
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <AuthForm
              mode={authMode}
              onModeChange={setAuthMode}
              title={authMode === 'reset' ? 'Reset admin password' : 'Admin sign-in'}
              subtitle={authMode === 'reset'
                ? 'Enter your administrator email to receive a password reset link.'
                : 'Sign in with the password for your provisioned administrator account.'}
              onAuthenticated={verifyAdmin}
            />
            <div style={{ textAlign: 'center' }}><Link className="back-home" href="/">← Back to dashboard</Link></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Spark Admin</Link>
        <nav className="topbar-actions">
          <Link className="topbar-link" href="/queries?room=expert">Expert inbox</Link>
          <span className="user-chip">{admin.email}</span>
          <button type="button" className="button button-ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      <main className="page-wrap">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div><div className="eyebrow">CONTENT STUDIO</div><h2 style={{ marginTop: 8 }}>Question paper builder</h2><p>Create a complete mock with marked answers and step-by-step solutions.</p></div>
        </div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        {notice && <div className="inline-alert inline-success" role="status">{notice}</div>}
        <div className="admin-grid">
          <section className="admin-card">
            <h2>{existingTestId ? 'Add to existing question paper' : 'New question paper'}</h2>
            {existingTestId && <p>Paper details are shown for reference. New questions will be added to this paper.</p>}
            <form onSubmit={(event) => {
              if (existingTestId) {
                event.preventDefault();
                addQuestionsToExistingTest();
              } else {
                createQuestionPaper(event);
              }
            }}>
              <label className="field-label" htmlFor="paper-title">Paper title</label>
              <input id="paper-title" className="admin-field" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="e.g. Graduate Mock Test 01" disabled={Boolean(existingTestId)} />
              <label className="field-label" htmlFor="paper-description">Description</label>
              <textarea id="paper-description" className="admin-field" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="What will this mock help candidates practise?" disabled={Boolean(existingTestId)} />
              <label className="field-label" htmlFor="paper-level">Exam level</label>
              <select id="paper-level" className="admin-field" value={level} onChange={(event) => setLevel(event.target.value)} disabled={Boolean(existingTestId)}>
                {levelChoices.map((choice) => <option key={choice}>{choice}</option>)}
              </select>
              <label className="field-label" htmlFor="paper-duration">Duration for the whole mock (minutes)</label>
              <input id="paper-duration" className="admin-field" type="number" min="1" max="300" value={duration} onChange={(event) => setDuration(event.target.value)} required disabled={Boolean(existingTestId)} />
              <label className="field-label" htmlFor="paper-access">Access</label>
              <select id="paper-access" className="admin-field" value={isFree ? 'free' : 'premium'} onChange={(event) => setIsFree(event.target.value === 'free')} disabled={Boolean(existingTestId)}>
                <option value="free">Free mock</option><option value="premium">Premium bundle</option>
              </select>
              {!isFree && (
                <>
                  <label className="field-label" htmlFor="bundle-id">Bundle ID</label>
                  {bundles.length ? (
                    <select id="bundle-id" className="admin-field" value={bundleId} onChange={(event) => setBundleId(event.target.value)} required disabled={Boolean(existingTestId)}>
                      <option value="">Choose a bundle</option>
                      {bundles.map((bundle) => <option value={bundle.id} key={bundle.id}>{bundle.name}</option>)}
                    </select>
                  ) : (
                    <input id="bundle-id" className="admin-field" value={bundleId} onChange={(event) => setBundleId(event.target.value)} required placeholder="Paste an existing bundle UUID" disabled={Boolean(existingTestId)} />
                  )}
                </>
              )}
              <button className="button button-primary" type="submit" disabled={busy || extracting || !title.trim()}>
                {busy ? (existingTestId ? 'Adding questions…' : 'Publishing…') : (existingTestId ? 'Add questions to selected mock' : 'Publish question paper')}
              </button>
            </form>
          </section>

          <section className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Questions <span style={{ color: '#8993a7', fontSize: 12 }}>({questions.length})</span></h2>
              <button className="button button-soft" type="button" disabled={busy || extracting} onClick={() => setQuestions((current) => [...current, blankQuestion()])}>＋ Add question</button>
            </div>
            <div className="question-import">
              <strong>Add questions to an existing mock</strong>
              <p>Choose a published mock or a paper in a bundle to load its details and add questions without creating another paper. Clear the selection to create a new paper.</p>
              {tests.length ? (
                <>
                  <label className="field-label" htmlFor="existing-test">Question paper</label>
                  <select
                    id="existing-test"
                    className="admin-field"
                    value={existingTestId}
                    onChange={(event) => selectExistingTest(event.target.value)}
                    disabled={busy || extracting}
                  >
                    <option value="">Choose a question paper</option>
                    {tests.map((test) => {
                      const bundle = Array.isArray(test.bundles) ? test.bundles[0] : test.bundles;
                      const accessLabel = test.is_free ? 'Free mock' : bundle?.name || 'Premium';
                      return (
                        <option value={test.id} key={test.id}>{test.title} · {test.level} · {accessLabel}</option>
                      );
                    })}
                  </select>
                  {tests.some((test) => (
                    test.id === existingTestId
                    && test.is_free
                    && test.title === removableMockTitle
                  )) && (
                    <button
                      className="button button-ghost"
                      type="button"
                      disabled={busy || extracting}
                      onClick={deleteSelectedMock}
                      style={{ color: '#b42318', marginTop: 12 }}
                    >
                      Delete AP SPECIAL TET 2026 (SET 1)
                    </button>
                  )}
                </>
              ) : <small>No published question papers are available yet.</small>}
            </div>
            <div className="question-import">
              <strong>Import questions from a document</strong>
              <p>Upload a text-based PDF or .docx. Questions, sections, choices, and answer keys will be extracted into editable drafts. Scanned PDFs need OCR first.</p>
              <input
                className="admin-field"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Choose a PDF or Word document"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              {uploadFile && <small className="question-import-file">{uploadFile.name}</small>}
              <label className="question-import-confirm">
                <input type="checkbox" checked={uploadAuthorized} onChange={(event) => setUploadAuthorized(event.target.checked)} />
                I have permission to use this document and send its text to the AI service for extraction.
              </label>
              <button className="button button-soft" type="button" disabled={extracting || busy || !uploadFile} onClick={extractQuestions}>
                {extracting ? 'Extracting questions…' : 'Extract editable questions'}
              </button>
            </div>
            {questions.map((question, index) => (
              <article className="question-editor" key={`question-${index}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <h3>Question {index + 1}</h3>
                  {questions.length > 1 && <button type="button" className="text-action" style={{ margin: 0 }} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
                </div>
                <select
                  className="admin-field"
                  aria-label={`Section for question ${index + 1}`}
                  value={typeof question.sectionDraft === 'string' ? addSectionHeadingOption : question.section}
                  onChange={(event) => changeQuestion(index, event.target.value === addSectionHeadingOption
                    ? { sectionDraft: '' }
                    : { section: event.target.value, sectionDraft: null })}
                >
                  {[...new Set([...sectionChoices, ...questions.map((item) => item.section).filter(Boolean)])].map((choice) => <option key={choice}>{choice}</option>)}
                  <option value={addSectionHeadingOption}>＋ Add section heading…</option>
                </select>
                {typeof question.sectionDraft === 'string' && (
                  <div className="admin-inline-fields">
                    <label className="field-label">New section heading
                      <input
                        className="admin-field"
                        aria-label={`New section heading for question ${index + 1}`}
                        value={question.sectionDraft}
                        maxLength={80}
                        onChange={(event) => changeQuestion(index, { sectionDraft: event.target.value })}
                        placeholder="Enter a section heading…"
                      />
                    </label>
                    <button
                      className="button button-soft"
                      type="button"
                      disabled={!question.sectionDraft.trim()}
                      onClick={() => changeQuestion(index, {
                        section: question.sectionDraft.trim(),
                        sectionDraft: null,
                      })}
                    >
                      Use section heading
                    </button>
                  </div>
                )}
                {question.answer_source === 'inferred' && <small className="question-answer-warning">AI-inferred answer · verify before publishing</small>}
                <textarea className="admin-field" aria-label={`Question ${index + 1} text`} rows={2} value={question.question_text} onChange={(event) => changeQuestion(index, { question_text: event.target.value })} placeholder="Write the question…" />
                <div className="admin-options-grid">
                  {question.options.map((option, optionIndex) => (
                    <input
                      className="admin-field"
                      key={`option-${optionIndex}`}
                      aria-label={`Question ${index + 1}, option ${String.fromCharCode(65 + optionIndex)}`}
                      value={option}
                      onChange={(event) => changeOption(index, optionIndex, event.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />
                  ))}
                </div>
                <div className="admin-inline-fields">
                  <label className="field-label">Correct answer
                    <select className="admin-field" value={question.correct_option} onChange={(event) => changeQuestion(index, { correct_option: event.target.value })}>
                      {['a', 'b', 'c', 'd'].map((option, optionIndex) => <option value={option} key={option}>Option {String.fromCharCode(65 + optionIndex)}</option>)}
                    </select>
                  </label>
                  <label className="field-label">Marks
                    <input className="admin-field" type="number" min="1" max="100" value={question.marks} onChange={(event) => changeQuestion(index, { marks: event.target.value })} />
                  </label>
                </div>
                <textarea className="admin-field" aria-label={`Solution for question ${index + 1}`} rows={3} value={question.explanation} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} placeholder="Explain why the answer is correct…" />
              </article>
            ))}
          </section>

          <section className="admin-card admin-list">
            <h2>Published papers</h2>
            {tests.length ? tests.map((test) => (
              <div className="admin-test-row" key={test.id}>
                <div><strong>{test.title}</strong><br /><span>{test.level} · {test.duration_minutes} min</span></div>
                <span>{test.is_free ? 'FREE' : 'PREMIUM'}</span>
              </div>
            )) : <div className="empty-state">No question papers created yet.</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
