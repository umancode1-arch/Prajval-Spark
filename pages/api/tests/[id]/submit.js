import { createServerSupabase, getRequestUser, getTestForUser } from '../../../../lib/serverTests';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { test, local, error, forbidden } = await getTestForUser(supabase, String(req.query.id), user);
    if (error) return res.status(forbidden ? 403 : 404).json({ error: error.message });
    if (!test.questions?.length) return res.status(404).json({ error: 'This question paper has no questions to grade.' });

    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'Submit an answer map to receive your results.' });
    }

    const allowedIds = new Set(test.questions.map((question) => question.id));
    for (const [questionId, answer] of Object.entries(answers)) {
      if (!allowedIds.has(questionId) || !['a', 'b', 'c', 'd'].includes(answer)) {
        return res.status(400).json({ error: 'One or more submitted answers are invalid.' });
      }
    }

    const totalMarks = test.questions.reduce((sum, question) => sum + question.marks, 0);
    const correctCount = test.questions.reduce((sum, question) => (
      sum + (answers[question.id] === question.correct_option ? 1 : 0)
    ), 0);
    const score = test.questions.reduce((sum, question) => (
      sum + (answers[question.id] === question.correct_option ? question.marks : 0)
    ), 0);
    const attempted = Object.keys(answers).length;
    const sections = [...new Set(test.questions.map((question) => question.section))];
    const sectionBreakdown = sections.map((section) => {
      const sectionQuestions = test.questions.filter((question) => question.section === section);
      return {
        section,
        total: sectionQuestions.reduce((sum, question) => sum + question.marks, 0),
        correct: sectionQuestions.filter((question) => answers[question.id] === question.correct_option).length,
        score: sectionQuestions.reduce((sum, question) => (
          sum + (answers[question.id] === question.correct_option ? question.marks : 0)
        ), 0),
      };
    });

    if (!local) {
      const { data: savedAttempt, error: saveError } = await supabase.from('attempts').insert({
        user_id: user.id,
        test_id: test.id,
        answers,
        score,
        total_marks: totalMarks,
      }).select('id').single();
      if (saveError) {
        return res.status(500).json({ error: `Your score was calculated but could not be saved: ${saveError.message}` });
      }
    }

    return res.status(200).json({
      score,
      totalMarks,
      attemptId: local ? null : savedAttempt.id,
      attempted,
      correct: correctCount,
      wrong: attempted - correctCount,
      unanswered: test.questions.length - attempted,
      accuracy: attempted ? Math.round((correctCount / attempted) * 100) : 0,
      sectionBreakdown,
      answerKey: test.questions.map((question) => ({
        id: question.id,
        section: question.section,
        question_text: question.question_text,
        options: question.options || [
          question.option_a,
          question.option_b,
          question.option_c,
          question.option_d,
        ],
        correct_option: question.correct_option,
        selected_option: answers[question.id] || null,
        marks: question.marks,
        explanation: question.explanation || 'Review the correct answer and revisit this topic.',
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Your answers could not be graded.' });
  }
}
