import { createClient } from '@supabase/supabase-js';
import { getMockTest } from './mockTests';
import isUuid from './isUuid';

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Server-side Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getRequestUser(req, supabase) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return { user: null, error: 'Sign in before opening this test.' };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, error: 'Your sign-in has expired. Sign in again to continue.' };
  return { user: data.user, error: null };
}

export async function getTestForUser(supabase, testId, user) {
  const localTest = getMockTest(testId);
  let test = localTest;
  const local = Boolean(localTest);
  if (!test) {
    const { data, error: testError } = await supabase
      .from('tests')
      .select('id,title,description,is_free,bundle_id,duration_minutes,level,questions(id,section,question_text,option_a,option_b,option_c,option_d,correct_option,marks,explanation,order_index)')
      .eq('id', testId)
      .single();

    if (testError) return { test: null, local, error: testError };
    test = data;
  }

  const requiresPurchase = local ? localTest.is_free === false : !test.is_free;
  if (requiresPurchase) {
    if (!isUuid(test.bundle_id)) {
      return {
        test: null,
        local,
        error: { message: 'This premium paper is not connected to a valid bundle.' },
        forbidden: true,
      };
    }
    const { data: admin, error: adminError } = await supabase
      .from('exam_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminError) return { test: null, local, error: adminError };

    if (!admin) {
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('bundle_id', test.bundle_id)
        .eq('status', 'success')
        .maybeSingle();
      if (purchaseError) return { test: null, local, error: purchaseError };
      if (!purchase) return { test: null, local, error: { message: 'This premium paper is locked. Purchase its bundle to access it.' }, forbidden: true };
    }
  }

  const questions = (test.questions || []).sort((left, right) => (left.order_index || 0) - (right.order_index || 0));
  return { test: { ...test, questions }, local, error: null };
}

export function publicQuestion(question, index) {
  const options = question.options || [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ];
  return {
    id: question.id,
    section: question.section,
    marks: question.marks,
    question_text: question.question_text,
    options,
    order_index: question.order_index ?? index,
  };
}
