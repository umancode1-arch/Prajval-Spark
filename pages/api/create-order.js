import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service role key here, not anon key
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { bundleId, userId } = req.body;

  const { data: bundle, error } = await supabaseAdmin
    .from('bundles').select('*').eq('id', bundleId).single();

  if (error || !bundle) return res.status(404).json({ error: 'Bundle not found' });

  const order = await razorpay.orders.create({
    amount: bundle.price_paise, // amount in paise, e.g. 19900 = ₹199
    currency: 'INR',
    receipt: `bundle_${bundleId}_${userId}`,
  });

  // Log a pending purchase row so we can verify later
  await supabaseAdmin.from('purchases').insert({
    user_id: userId,
    bundle_id: bundleId,
    razorpay_order_id: order.id,
    status: 'pending',
  });

  res.status(200).json(order);
}
