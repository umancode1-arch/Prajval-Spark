import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDemoUser, clearDemoUser } from '../lib/demoAuth';

const sampleTests = [
  {
    id: 1,
    title: 'Free Diagnostic Test',
    description: 'A 25-question starter test to understand your preparation level.',
    is_free: true,
    score: '82/100',
    bundle_id: null,
    time: '25 mins',
    difficulty: 'Beginner',
  },
  {
    id: 2,
    title: 'Quant Sprint Series',
    description: 'High-priority arithmetic and logic questions with timed practice.',
    is_free: false,
    score: 'Leadership',
    bundle_id: 'bundle-1',
    time: '45 mins',
    difficulty: 'Intermediate',
  },
  {
    id: 3,
    title: 'Reasoning Mastery',
    description: 'A focused reasoning pack for pattern recognition and accuracy.',
    is_free: false,
    bundle_id: 'bundle-2',
    score: 'Top 10%',
    time: '50 mins',
    difficulty: 'Advanced',
  },
];

const testimonials = [
  { name: 'Riya S.', text: 'The free mock test showed me exactly where I needed to improve. The scoring breakdown is very clear and actionable.' },
  { name: 'Amit K.', text: 'I booked the premium bundle and used the timed tests every evening. My confidence increased noticeably within two weeks.' },
  { name: 'Priya M.', text: 'The test series feels realistic and the explanations are crisp. It feels like a proper prep dashboard for serious candidates.' },
];

export default function Home() {
  const [tests, setTests] = useState(sampleTests);
  const [purchasedBundles, setPurchasedBundles] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = getDemoUser();
    setUser(currentUser);
  }, []);

  const isUnlocked = (test) => test.is_free || purchasedBundles.includes(test.bundle_id);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.brand}>Prajval Spark</div>
            <h1 style={styles.title}>Exam prep that actually moves you forward.</h1>
          </div>
          {!user ? (
            <div style={styles.authButtons}>
              <Link href="/login" style={styles.secondaryButton}>Login</Link>
              <Link href="/signup" style={styles.primaryButton}>Create account</Link>
            </div>
          ) : (
            <div style={styles.authButtons}>
              <div style={styles.userBadge}>{user.email}</div>
              <button
                type="button"
                onClick={() => {
                  clearDemoUser();
                  setUser(null);
                }}
                style={styles.logoutButton}
              >
                Logout
              </button>
            </div>
          )}
        </header>

        <section style={styles.heroCard}>
          <div>
            <div style={styles.kicker}>Free Test</div>
            <h2 style={styles.heroTitle}>Sample Free Test</h2>
            <p style={styles.heroDescription}>Take the first test of the week and see your score instantly with detailed accuracy analytics.</p>
            <div style={styles.heroMeta}>
              <span>25 Questions</span>
              <span>•</span>
              <span>25 mins</span>
              <span>•</span>
              <span>Beginner</span>
            </div>
          </div>

          <div style={styles.scoreCard}>
            <div style={styles.scoreLabel}>Last score</div>
            <div style={styles.scoreValue}>82/100</div>
            <div style={styles.scoreTrend}>+12% this week</div>
          </div>
        </section>

        <section style={styles.metricsRow}>
          <div style={styles.metricBox}><span style={styles.metricTitle}>Attempted Tests</span><strong>24</strong></div>
          <div style={styles.metricBox}><span style={styles.metricTitle}>Average Score</span><strong>84%</strong></div>
          <div style={styles.metricBox}><span style={styles.metricTitle}>Accuracy</span><strong>78%</strong></div>
          <div style={styles.metricBox}><span style={styles.metricTitle}>Rank</span><strong>#132</strong></div>
        </section>

        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Popular test series</h3>
          </div>

          <div style={styles.testGrid}>
            {tests.map((test) => (
              <div key={test.id} style={styles.testCard}>
                <div style={styles.testHeader}>
                  <div>
                    <div style={styles.testTag}>{test.is_free ? 'Free' : 'Premium'}</div>
                    <h4 style={styles.testTitle}>{test.title}</h4>
                  </div>
                  <span style={styles.testDifficulty}>{test.difficulty}</span>
                </div>

                <p style={styles.testDescription}>{test.description}</p>

                <div style={styles.testMeta}>
                  <span>{test.time}</span>
                  <span>•</span>
                  <span>{test.score}</span>
                </div>

                {isUnlocked(test) ? (
                  <Link href={`/test/${test.id}`} style={styles.openButton}>Open test</Link>
                ) : (
                  <Link href={`/bundle/${test.bundle_id || 'demo'}`} style={styles.lockButton}>Unlock ₹199</Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Student testimonials</h3>
          </div>

          <div style={styles.testimonialGrid}>
            {testimonials.map((item) => (
              <div key={item.name} style={styles.testimonialCard}>
                <div style={styles.stars}>★★★★★</div>
                <p style={styles.testimonialText}>“{item.text}”</p>
                <strong style={styles.personName}>{item.name}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8fbff 0%, #eef9ff 100%)',
    padding: '32px 20px 60px',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  brand: {
    display: 'inline-block',
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#2563eb',
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3.2rem)',
    lineHeight: 1.1,
    color: '#0f172a',
    maxWidth: 700,
  },
  authButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontWeight: 700,
  },
  secondaryButton: {
    background: '#fff',
    color: '#0f172a',
    textDecoration: 'none',
    border: '1px solid #dfe7f3',
    borderRadius: 12,
    padding: '12px 18px',
    fontWeight: 700,
  },
  userBadge: {
    background: '#ecfdf5',
    color: '#065f46',
    borderRadius: 999,
    padding: '9px 14px',
    fontWeight: 700,
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutButton: {
    background: '#fff1f2',
    color: '#be123c',
    border: '1px solid #fecdd3',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  heroCard: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
    color: '#fff',
    borderRadius: 28,
    padding: '36px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    marginBottom: 26,
    boxShadow: '0 20px 50px rgba(37, 99, 235, 0.18)',
    flexWrap: 'wrap',
  },
  kicker: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  heroTitle: {
    margin: '12px 0 10px',
    fontSize: 38,
  },
  heroDescription: {
    margin: 0,
    maxWidth: 620,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.7,
    fontSize: 17,
  },
  heroMeta: {
    marginTop: 16,
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 600,
  },
  scoreCard: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 18,
    padding: '20px 22px',
    minWidth: 180,
  },
  scoreLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: 800,
    margin: '8px 0',
  },
  scoreTrend: {
    color: '#bbf7d0',
    fontWeight: 700,
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  metricBox: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.03)',
  },
  metricTitle: {
    color: '#64748b',
    fontSize: 13,
  },
  sectionBlock: {
    marginTop: 30,
  },
  sectionHeader: {
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
    color: '#0f172a',
  },
  testGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 18,
  },
  testCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 12px 22px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  testTag: {
    display: 'inline-block',
    borderRadius: 999,
    padding: '6px 10px',
    background: '#ecfeff',
    color: '#0f766e',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  testTitle: {
    margin: '10px 0 0',
    fontSize: 22,
    color: '#0f172a',
  },
  testDifficulty: {
    background: '#f1f5f9',
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 11,
    color: '#475569',
    fontWeight: 700,
  },
  testDescription: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.7,
    minHeight: 70,
  },
  testMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#334155',
    fontWeight: 600,
    fontSize: 14,
  },
  openButton: {
    display: 'block',
    marginTop: 'auto',
    background: '#0f172a',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    textAlign: 'center',
    fontWeight: 700,
  },
  lockButton: {
    display: 'block',
    marginTop: 'auto',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    textAlign: 'center',
    fontWeight: 700,
  },
  testimonialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 18,
  },
  testimonialCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 22,
  },
  stars: {
    color: '#f59e0b',
    letterSpacing: 1,
    marginBottom: 12,
  },
  testimonialText: {
    margin: '0 0 18px',
    color: '#475569',
    lineHeight: 1.7,
  },
  personName: {
    fontSize: 15,
    color: '#0f172a',
  },
};
