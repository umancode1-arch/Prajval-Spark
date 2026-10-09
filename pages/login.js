import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AuthForm from '../components/AuthForm';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login');

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const continueTo = () => {
    const requestedPath = typeof router.query.next === 'string' ? router.query.next : '/';
    const safePath = requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
    return router.push(safePath);
  };

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <div className="auth-visual-copy">
          <div className="eyebrow">Your next chapter starts here</div>
          <h2>Make every practice session count.</h2>
          <p>Build exam confidence with focused mock tests, clear answer explanations, and support when you need it.</p>
        </div>
        <div className="auth-perks"><span>✓ Level-based practice</span><span>✓ Instant insights</span><span>✓ Expert guidance</span></div>
      </section>
      <section className="auth-panel-wrap">
        <div>
          <AuthForm
            mode={mode}
            onModeChange={setMode}
            title={mode === 'update' ? 'Choose a new password' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}
            subtitle={mode === 'update'
              ? 'Set a new password for your account.'
              : mode === 'reset'
                ? 'Enter your account email and we’ll send a password reset link.'
                : 'Sign in with your email and password to continue your preparation.'}
            onAuthenticated={continueTo}
          />
          <div style={{ textAlign: 'center' }}>
            <Link className="back-home" href="/">← Back to dashboard</Link>
            <span style={{ color: '#c3c9d5', margin: '0 9px' }}>·</span>
            <Link className="back-home" href="/signup">Create account</Link>
            <span style={{ color: '#c3c9d5', margin: '0 9px' }}>·</span>
            <Link className="back-home" href="/admin">Admin sign-in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
