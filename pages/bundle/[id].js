import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getDemoUser } from '../../lib/demoAuth';

export default function BundlePage() {
  const router = useRouter();
  const { id } = router.query;
  const [bundle, setBundle] = useState(null);

  useEffect(() => {
    if (!id) return;
    const demoBundle = {
      id,
      name: 'Complete Mock Series',
      price_paise: 19900,
      description: 'Premium practice pack for mock exams and mock rankings.',
    };
    setBundle(demoBundle);
  }, [id]);

  const handlePay = async () => {
    const user = getDemoUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Ask our backend to create a Razorpay order
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundleId: id, userId: user.id }),
    });
    const order = await res.json();

    // 2. Open Razorpay checkout
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: 'INR',
      name: 'Test Series',
      description: bundle?.name,
      order_id: order.id,
      handler: async function (response) {
        // 3. Verify payment on backend, then unlock
        await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            bundleId: id,
            userId: user.id,
          }),
        });
        router.push('/?purchased=1');
      },
      prefill: { email: user.email },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  if (!bundle) return <p>Loading...</p>;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div style={{ maxWidth: 500, margin: '80px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2>{bundle.name}</h2>
        <p style={{ fontSize: 28 }}>₹{bundle.price_paise / 100}</p>
        <button onClick={handlePay} style={{ padding: '12px 24px', fontSize: 16 }}>
          Pay & Unlock
        </button>
      </div>
    </>
  );
}
