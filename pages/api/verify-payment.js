import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bundleId,
    userId,
  } = req.body;

  // Verify the signature to make sure this callback is genuinely from Razorpay
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid = expectedSignature === razorpay_signature;

  await supabaseAdmin
    .from('purchases')
    .update({
      razorpay_payment_id,
      status: isValid ? 'success' : 'failed',
    })
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('user_id', userId)
    .eq('bundle_id', bundleId);

  res.status(200).json({ success: isValid });
}
