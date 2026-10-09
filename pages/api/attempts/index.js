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

    const { data: attempts, error: attemptsError } = await supabase
      .from('attempts')
      .select('id,test_id,score,total_marks,submitted_at')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    if (attemptsError) return res.status(500).json({ error: `Attempt history could not be loaded: ${attemptsError.message}` });

    const testIds = [...new Set((attempts || []).map((attempt) => attempt.test_id).filter(Boolean))];
    const testsById = new Map();
    if (testIds.length) {
      const { data: tests, error: testsError } = await supabase
        .from('tests')
        .select('id,title,level')
        .in('id', testIds);
      if (testsError) return res.status(500).json({ error: `Attempt test details could not be loaded: ${testsError.message}` });
      (tests || []).forEach((test) => testsById.set(test.id, test));
    }

    return res.status(200).json({
      attempts: (attempts || []).map((attempt) => {
        const test = testsById.get(attempt.test_id);
        return {
          id: attempt.id,
          testId: attempt.test_id,
          testTitle: test?.title || 'Question paper',
          level: test?.level || 'Graduate',
          score: attempt.score || 0,
          total: attempt.total_marks || 0,
          submittedAt: attempt.submitted_at,
          source: 'database',
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Attempt history could not be loaded.' });
  }
}
