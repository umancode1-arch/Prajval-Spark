import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function errorMessage(error, action) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message && message !== '{}' && message !== '[object Object]') return `${action}: ${message}`;
  const status = Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : '';
  return `${action}. Supabase returned an empty error${status}; check Supabase Dashboard → Authentication → Logs.`;
}

export default function AuthForm({
  title,
  subtitle,
  mode = 'login',
  onAuthenticated,
  onModeChange,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isSupabaseConfigured) {
      setError('Authentication is unavailable because NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid in .env.local. Add the anon or publishable key from Supabase Dashboard → Project Settings → API Keys, then restart the app. Do not use the service-role key here.');
      return;
    }

    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/login?reset=1`,
        });
        if (resetError) {
          setError(errorMessage(resetError, 'Password reset email could not be sent'));
          return;
        }
        setNotice('If an account exists for this email, Supabase will send a password reset link. Check your inbox and spam folder.');
        return;
      }

      if (mode === 'update') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(errorMessage(updateError, 'Your password could not be updated'));
          return;
        }
        setNotice('Your password has been updated. You can now sign in with it.');
        setPassword('');
        onModeChange?.('login');
        return;
      }

      if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (signupError) {
          setError(errorMessage(signupError, 'Account could not be created'));
          return;
        }
        if (!data.session || !data.user) {
          setNotice('Account created. Check your email for a confirmation link, then return here to sign in with your password.');
          return;
        }
        await onAuthenticated?.(data.user);
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (loginError) {
        setError(errorMessage(loginError, 'Sign-in failed'));
        return;
      }
      if (!data.session || !data.user) {
        setError('Supabase did not return a sign-in session. Please try again.');
        return;
      }
      await onAuthenticated?.(data.user);
    } catch (authError) {
      setError(errorMessage(authError, 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  };

  const isPasswordResetRequest = mode === 'reset';
  const isPasswordUpdate = mode === 'update';
  const isSignup = mode === 'signup';
  const showPassword = !isPasswordResetRequest;
  const passwordLabel = isPasswordUpdate ? 'New password' : 'Password';

  return (
    <section className="auth-panel">
      <div className="auth-eyebrow">PRAJVAL SPARK · SECURE ACCOUNT</div>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      <form onSubmit={submit} className="auth-form">
        {mode !== 'update' && (
          <>
            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              className="text-field"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </>
        )}
        {showPassword && (
          <>
            <label className="field-label" htmlFor="password">{passwordLabel}</label>
            <input
              id="password"
              className="text-field"
              type="password"
              autoComplete={isSignup || isPasswordUpdate ? 'new-password' : 'current-password'}
              placeholder={isSignup || isPasswordUpdate ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={isSignup || isPasswordUpdate ? 8 : undefined}
              required
            />
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : isPasswordResetRequest
              ? 'Send password reset link'
              : isPasswordUpdate
                ? 'Update password'
                : isSignup
                  ? 'Create account'
                  : 'Sign in'}
        </button>
      </form>
      {mode === 'login' && (
        <button className="text-action" type="button" onClick={() => onModeChange?.('reset')}>
          Forgot password?
        </button>
      )}
      {(mode === 'reset' || mode === 'update') && (
        <button className="text-action" type="button" onClick={() => onModeChange?.('login')}>
          Back to sign in
        </button>
      )}
      <div className="auth-assurance"><span>✦</span> Your password is securely managed by Supabase.</div>
    </section>
  );
}
