import { createServerSupabase, getRequestUser } from '../../lib/serverTests';
import isUuid from '../../lib/isUuid';
import mockTests from '../../lib/mockTests';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (process.env.NEXT_PUBLIC_PREMIUM_DEMO_ACCESS_ENABLED !== 'true') {
    return res.status(410).json({ error: 'Temporary premium access is disabled in this environment.' });
  }

  try {
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { bundleId } = req.body || {};
    if (!isUuid(bundleId)) {
      return res.status(400).json({ error: 'Choose a valid test-series bundle.' });
    }

    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('id')
      .eq('id', bundleId)
      .single();
    if (bundleError || !bundle) return res.status(404).json({ error: 'Bundle not found.' });

    const localTest = mockTests.find((test) => test.bundle_id === bundle.id);
    let testId = localTest?.id;
    if (!testId) {
      const { data: test, error: testError } = await supabase
        .from('tests')
        .select('id')
        .eq('bundle_id', bundle.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (testError) return res.status(500).json({ error: `A test in this bundle could not be found: ${testError.message}` });
      if (!test) return res.status(404).json({ error: 'This bundle does not contain a test to launch.' });
      testId = test.id;
    }

    const { data: approved, error: approvedError } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('bundle_id', bundle.id)
      .eq('status', 'success')
      .limit(1)
      .maybeSingle();
    if (approvedError) return res.status(500).json({ error: `Existing access could not be checked: ${approvedError.message}` });
    if (approved) return res.status(200).json({
      alreadyApproved: true,
      purchaseId: approved.id,
      testPath: `/test/${encodeURIComponent(testId)}`,
    });

    const { data: pending, error: pendingError } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('bundle_id', bundle.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (pendingError) return res.status(500).json({ error: `Existing payment requests could not be checked: ${pendingError.message}` });

    let purchase = pending;
    if (pending) {
      const { data: approvedPurchase, error: approveError } = await supabase
        .from('purchases')
        .update({ status: 'success' })
        .eq('id', pending.id)
        .eq('status', 'pending')
        .select('id')
        .single();
      if (approveError) return res.status(500).json({ error: `Temporary access could not be approved: ${approveError.message}` });
      purchase = approvedPurchase;
    } else {
      const { data: approvedPurchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({ user_id: user.id, bundle_id: bundle.id, status: 'success' })
        .select('id')
        .single();
      if (purchaseError) return res.status(500).json({ error: `Temporary access could not be approved: ${purchaseError.message}` });
      purchase = approvedPurchase;
    }

    return res.status(200).json({
      purchaseId: purchase.id,
      testPath: `/test/${encodeURIComponent(testId)}`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Temporary access could not be approved.' });
  }
}
