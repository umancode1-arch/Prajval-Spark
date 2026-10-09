import Razorpay from 'razorpay';
import { createServerSupabase, getRequestUser } from '../../lib/serverTests';
import isUuid from '../../lib/isUuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (process.env.RAZORPAY_CHECKOUT_ENABLED !== 'true') {
    return res.status(410).json({ error: 'Razorpay checkout is paused. Use the manual QR payment flow.' });
  }

  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Razorpay is not configured on the server.' });
    }
    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const { bundleId } = req.body || {};
    if (!isUuid(bundleId)) {
      return res.status(400).json({ error: 'Choose a valid test-series bundle.' });
    }

    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('id,name,price_paise')
      .eq('id', bundleId)
      .single();
    if (bundleError || !bundle) return res.status(404).json({ error: 'Bundle not found.' });
    if (!Number.isSafeInteger(bundle.price_paise) || bundle.price_paise <= 0) {
      return res.status(400).json({ error: 'This bundle does not have a valid price.' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await razorpay.orders.create({
      amount: bundle.price_paise,
      currency: 'INR',
      receipt: `bundle_${bundle.id.slice(0, 8)}_${user.id.slice(0, 8)}_${Date.now().toString(36)}`,
    });

    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: user.id,
      bundle_id: bundle.id,
      razorpay_order_id: order.id,
      status: 'pending',
    });
    if (purchaseError) {
      return res.status(500).json({ error: `Checkout was created but could not be recorded: ${purchaseError.message}` });
    }
    return res.status(200).json(order);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'A checkout order could not be created.' });
  }
}
