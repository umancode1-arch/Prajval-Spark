import { useState } from 'react';
import { useRouter } from 'next/router';
import { demoSignIn } from '../lib/demoAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = demoSignIn({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push('/');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.cardWrap}>
        <div style={styles.leftPanel}>
          <div style={styles.badge}>Smart Prep</div>
          <h1 style={styles.heading}>Your next rank starts here.</h1>
          <p style={styles.subText}>Practice free mock tests, track your score, and unlock premium test series designed for exam success.</p>

          <div style={styles.metricRow}>
            <div style={styles.metricBox}>
              <strong>12k+</strong>
              <span>Students</span>
            </div>
            <div style={styles.metricBox}>
              <strong>4.8/5</strong>
              <span>Ratings</span>
            </div>
            <div style={styles.metricBox}>
              <strong>92%</strong>
              <span>Improvement</span>
            </div>
          </div>
        </div>

        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Welcome back</h2>
          <p style={styles.formSubtitle}>Log in to continue your prep.</p>

          <form onSubmit={handleLogin}>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <p style={styles.footerText}>
            New here? <a href="/signup" style={styles.link}>Create account</a>
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
    background: 'linear-gradient(135deg, #eef6ff 0%, #f7f5ff 50%, #fff1f6 100%)',
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
    boxShadow: '0 20px 60px rgba(59, 78, 131, 0.12)',
    overflow: 'hidden',
  },
  leftPanel: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
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
  metricRow: {
    display: 'flex',
    gap: 18,
    marginTop: 30,
    flexWrap: 'wrap',
  },
  metricBox: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: '14px 16px',
    minWidth: 120,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
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
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
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
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
