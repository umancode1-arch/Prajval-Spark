import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import isUuid from '../../lib/isUuid';

const demoAccessEnabled = process.env.NEXT_PUBLIC_PREMIUM_DEMO_ACCESS_ENABLED === 'true';

export default function BundlePage() {
  const router = useRouter();
  const { id } = router.query;
  const bundleId = Array.isArray(id) ? id[0] : id;
  const [bundle, setBundle] = useState(null);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bundleId) return;
    setBundle(null);
    setError('');
    if (!isUuid(bundleId)) {
      setError('This premium test series is not linked to a Supabase bundle yet. Set its bundle_id in the local test catalog to the UUID of a bundle in your Supabase project.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Premium checkout requires a configured Supabase project.');
      return;
    }

    let active = true;
    async function loadBundle() {
      try {
        const { data, error: bundleError } = await supabase
          .from('bundles')
          .select('id,name,price_paise')
          .eq('id', bundleId)
          .single();

        if (!active) return;
        if (bundleError || !data) {
          setError(`This premium bundle could not be loaded${bundleError?.message ? `: ${bundleError.message}` : '.'}`);
          return;
        }
        if (!Number.isSafeInteger(data.price_paise) || data.price_paise <= 0) {
          setError('This premium bundle does not have a valid price.');
          return;
        }
        setError('');
        setBundle({
          ...data,
          description: 'Unlock premium practice papers in this test series.',
        });
      } catch (loadError) {
        if (active) setError(`This premium bundle could not be loaded: ${loadError.message}`);
      }
    }
    loadBundle();
    return () => { active = false; };
  }, [bundleId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(`Your session could not be checked: ${sessionError.message}`);
      setUser(data?.session?.user || null);
    });
  }, []);

  const handlePaymentRequest = async () => {
    setError('');
    if (!isSupabaseConfigured) {
      setError('Manual payment requests require a configured Supabase project.');
      return;
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error(sessionError?.message || 'Your sign-in expired. Sign in again to continue.');
      }
      const response = await fetch('/api/manual-purchase', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bundleId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Temporary access could not be approved.');
      if (typeof result.testPath !== 'string' || !result.testPath.startsWith('/test/')) {
        throw new Error('Access was approved, but the test could not be launched. Return to the dashboard and try again.');
      }
      await router.push(result.testPath);
    } catch (paymentError) {
      setError(paymentError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!bundle) return (
    <main className="page-wrap">
      {error
        ? <div className="inline-alert" role="alert">{error}</div>
        : <div className="empty-state">Loading bundle…</div>}
    </main>
  );

  return (
    <main className="page-wrap" style={{ maxWidth: 760 }}>
      <Link href="/" className="topbar-link">← Dashboard</Link>
      <section className="results-hero" style={{ marginTop: 18 }}>
        <div>
          <div className="eyebrow">PREMIUM TEST SERIES</div>
          <h1>{bundle.name}</h1>
          <p>{bundle.description}</p>
        </div>
        <div className="result-score"><strong>₹{bundle.price_paise / 100}</strong><span>one-time purchase</span></div>
      </section>
      {error && <div className="inline-alert" role="alert">{error}</div>}
      <div className="inline-alert" role="status" style={{ marginTop: 17 }}>
        {demoAccessEnabled
          ? 'Temporary testing mode: clicking “I’ve paid — request access” grants this account access and launches the first test in this bundle. No payment is collected or verified.'
          : 'Temporary premium access is disabled. No payment is collected or verified on this page.'}
      </div>
      <section className="empty-state" style={{ margin: '17px 0', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Pay by PhonePe QR</h2>
        <p>The QR is shown for reference only in temporary testing mode. The access button below does not confirm a payment.</p>
        <Image
          src="/phonepe-payment-qr.png"
          alt="PhonePe payment QR code"
          width={300}
          height={517}
          priority
          style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
        />
      </section>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button className="button button-primary" onClick={handlePaymentRequest} disabled={busy || !demoAccessEnabled}>
          {busy ? 'Submitting…' : demoAccessEnabled ? 'I’ve paid — request access' : 'Temporary access disabled'}
        </button>
        <Link className="button button-ghost" href="/">Not now</Link>
      </div>
      {!user && <div className="empty-state" style={{ margin: '17px 0' }}>Sign in before submitting a payment request.</div>}
    </main>
  );
}
