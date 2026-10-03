import { useState } from 'react';
import { useRouter } from 'next/router';
import { demoSignUp } from '../lib/demoAuth';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = demoSignUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/');
  };

  return (
    <div style={styles.page}>
      <div style={styles.cardWrap}>
        <div style={styles.leftPanel}>
          <div style={styles.badge}>Start Free</div>
          <h1 style={styles.heading}>Build momentum with smarter practice.</h1>
          <p style={styles.subText}>Access free diagnostic tests, track your performance, and unlock premium exam series as you grow.</p>

          <div style={styles.featureList}>
            <div style={styles.featureItem}>✓ Free mock test every week</div>
            <div style={styles.featureItem}>✓ Personalized score analytics</div>
            <div style={styles.featureItem}>✓ Premium bundles for targeted practice</div>
          </div>
        </div>

        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Create account</h2>
          <p style={styles.formSubtitle}>No email verification required for demo access.</p>

          <form onSubmit={handleSignup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={styles.input}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <p style={styles.footerText}>
            Already have an account? <a href="/login" style={styles.link}>Login</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 50%, #fdf2f8 100%)',
    padding: '32px 20px',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 1100,
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    background: '#ffffff',
    borderRadius: 28,
    boxShadow: '0 20px 60px rgba(15, 118, 110, 0.12)',
    overflow: 'hidden',
  },
  leftPanel: {
    background: 'linear-gradient(135deg, #0f766e 0%, #0f172a 100%)',
    color: '#ffffff',
    padding: '52px 42px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  badge: {
    width: 'fit-content',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.12)',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  heading: {
    margin: '18px 0 12px',
    fontSize: 42,
    lineHeight: 1.1,
    fontWeight: 800,
  },
  subText: {
    margin: 0,
    maxWidth: 470,
    fontSize: 17,
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.82)',
  },
  featureList: {
    marginTop: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  featureItem: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '12px 14px',
    fontWeight: 600,
  },
  formCard: {
    background: '#ffffff',
    padding: '52px 42px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  formTitle: {
    margin: 0,
    fontSize: 34,
    color: '#0f172a',
  },
  formSubtitle: {
    margin: '8px 0 28px',
    color: '#64748b',
    fontSize: 15,
  },
  label: {
    display: 'block',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #dfe7f3',
    fontSize: 15,
    marginBottom: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    marginTop: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
  },
  error: {
    color: '#d93025',
    fontSize: 13,
    margin: '0 0 14px',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 18,
    color: '#475569',
    fontSize: 14,
  },
  link: {
    color: '#0f766e',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
