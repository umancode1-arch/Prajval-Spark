import crypto from 'crypto';
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
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(503).json({ error: 'Razorpay is not configured on the server.' });

    const supabase = createServerSupabase();
    const { user, error: authError } = await getRequestUser(req, supabase);
    if (authError) return res.status(401).json({ error: authError });

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      bundleId,
    } = req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value) || !isUuid(bundleId)) {
      return res.status(400).json({ error: 'Payment verification details are incomplete.' });
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id')
      .eq('razorpay_order_id', orderId)
      .eq('user_id', user.id)
      .eq('bundle_id', bundleId)
      .eq('status', 'pending')
      .maybeSingle();
    if (purchaseError) return res.status(500).json({ error: `The purchase could not be checked: ${purchaseError.message}` });
    if (!purchase) return res.status(404).json({ error: 'No pending checkout was found for this signed-in account.' });

    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
    let provided;
    try {
      provided = Buffer.from(signature, 'hex');
    } catch {
      return res.status(400).json({ error: 'The payment signature is invalid.' });
    }
    if (provided.length !== expected.length || !crypto.timingSafeEqual(expected, provided)) {
      return res.status(400).json({ error: 'The payment signature is invalid.' });
    }

    const { error: updateError } = await supabase
      .from('purchases')
      .update({ razorpay_payment_id: paymentId, status: 'success' })
      .eq('id', purchase.id)
      .eq('status', 'pending');
    if (updateError) return res.status(500).json({ error: `Payment was verified but the purchase could not be updated: ${updateError.message}` });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Payment verification failed.' });
  }
}
