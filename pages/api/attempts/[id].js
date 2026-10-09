import { createServerSupabase, getRequestUser } from '../../../lib/serverTests';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('id,test_id,answers,score,total_marks,submitted_at')
      .eq('id', String(req.query.id))
      .eq('user_id', user.id)
      .maybeSingle();
    if (attemptError) return res.status(500).json({ error: `Attempt details could not be loaded: ${attemptError.message}` });
    if (!attempt) return res.status(404).json({ error: 'This attempted test could not be found.' });

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id,title,level,questions(id,section,question_text,option_a,option_b,option_c,option_d,correct_option,marks,explanation,order_index)')
      .eq('id', attempt.test_id)
      .maybeSingle();
    if (testError) return res.status(500).json({ error: `The attempted question paper could not be loaded: ${testError.message}` });
    if (!test) return res.status(404).json({ error: 'The question paper for this attempt is no longer available.' });

    const questions = [...(test.questions || [])].sort((left, right) => left.order_index - right.order_index);
    const answers = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
    const sections = [...new Set(questions.map((question) => question.section))];
    const sectionBreakdown = sections.map((section) => {
      const sectionQuestions = questions.filter((question) => question.section === section);
      return {
        section,
        total: sectionQuestions.reduce((sum, question) => sum + question.marks, 0),
        correct: sectionQuestions.filter((question) => answers[question.id] === question.correct_option).length,
        score: sectionQuestions.reduce((sum, question) => (
          sum + (answers[question.id] === question.correct_option ? question.marks : 0)
        ), 0),
      };
    });
    const attempted = Object.keys(answers).length;
    const correct = questions.filter((question) => answers[question.id] === question.correct_option).length;

    return res.status(200).json({
      attempt: {
        id: attempt.id,
        testId: test.id,
        testTitle: test.title,
        level: test.level || 'Graduate',
        score: attempt.score || 0,
        total: attempt.total_marks || 0,
        submittedAt: attempt.submitted_at,
        attempted,
        correct,
        wrong: attempted - correct,
        unanswered: Math.max(questions.length - attempted, 0),
        accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
        sectionBreakdown,
        answerKey: questions.map((question) => ({
          id: question.id,
          section: question.section,
          question_text: question.question_text,
          options: [question.option_a, question.option_b, question.option_c, question.option_d],
          correct_option: question.correct_option,
          selected_option: answers[question.id] || null,
          marks: question.marks,
          explanation: question.explanation || 'Review the correct answer and revisit this topic.',
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Attempt details could not be loaded.' });
  }
}
