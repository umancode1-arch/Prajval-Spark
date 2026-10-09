import { createServerSupabase, getRequestUser, getTestForUser, publicQuestion } from '../../../lib/serverTests';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { test, local, error, forbidden } = await getTestForUser(supabase, String(req.query.id), user);
    if (error) return res.status(forbidden ? 403 : 404).json({ error: error.message });
    if (!test.questions?.length) return res.status(404).json({ error: 'This question paper has no questions yet.' });

    return res.status(200).json({
      id: test.id,
      title: test.title,
      level: test.level || 'Graduate',
      local,
      duration_minutes: test.duration || test.duration_minutes,
      questions: test.questions.map(publicQuestion),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'The question paper could not be loaded.' });
  }
}
