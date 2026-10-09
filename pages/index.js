import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import mockTests from '../lib/mockTestCatalog';
import { getAttemptHistory } from '../lib/attemptHistory';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const levelIcons = { 'class-10': '◈', 'class-12': '✳', graduate: '✦' };
const attemptLevels = [
  { value: '10th', label: '10th based level' },
  { value: 'inter', label: 'Inter based level' },
  { value: 'graduate', label: 'Graduate level' },
];

function getAttemptLevel(level = '') {
  const normalized = level.toLowerCase();
  if (normalized.includes('10') || normalized.includes('matric')) return '10th';
  if (normalized.includes('12') || normalized.includes('inter')) return 'inter';
  if (normalized.includes('grad')) return 'graduate';
  return '';
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminTests, setAdminTests] = useState([]);
  const [history, setHistory] = useState([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [loadingAttemptId, setLoadingAttemptId] = useState('');
  const [attemptError, setAttemptError] = useState('');
  const [purchasedBundles, setPurchasedBundles] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [dataError, setDataError] = useState('');

  const loadDashboardData = useCallback(async (activeUser) => {
    setLoadingTests(true);
    setAttemptError('');
    const localHistory = activeUser
      ? getAttemptHistory(activeUser.email).filter((attempt) => mockTests.some((test) => test.id === attempt.testId))
      : [];
    setHistory(localHistory);
    setSelectedAttempt(null);
    setPurchasedBundles([]);
    if (!isSupabaseConfigured) {
      setDataError('Community papers are unavailable because the Supabase anon key is missing or invalid. Set a valid NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the app.');
      setAdminTests([]);
      setLoadingTests(false);
      return;
    }

    const { data, error } = await supabase
      .from('tests')
      .select('id,title,description,duration_minutes,level,is_free,bundle_id,bundles(id,name,price_paise)')
      .order('created_at', { ascending: false });

    if (error) {
      const missingTestsTable = error.code === 'PGRST205'
        || /could not find the table ['"]?public\.tests['"]? in the schema cache/i.test(error.message || '');
      setDataError(missingTestsTable
        ? 'The Supabase database tables are not installed yet (public.tests is missing). In your Supabase project, open SQL Editor, paste and run the full supabase-schema.sql file from this project. Then reload the dashboard. If you already ran it, confirm this app uses the same Supabase project URL and run: NOTIFY pgrst, \'reload schema\';'
        : `Community question papers could not be loaded: ${error.message}`);
      setAdminTests([]);
      setLoadingTests(false);
      return;
    }
    setDataError('');
    setAdminTests(data || []);

    if (activeUser) {
      const { data: purchases, error: purchaseError } = await supabase
        .from('purchases')
        .select('bundle_id')
        .eq('user_id', activeUser.id)
        .eq('status', 'success');
      if (purchaseError) {
        setDataError(`Test series loaded, but purchase access could not be checked: ${purchaseError.message}`);
      } else {
        setPurchasedBundles([...new Set((purchases || []).map((purchase) => purchase.bundle_id))]);
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setAttemptError(`Your attempted tests could not be loaded: ${sessionError?.message || 'Your sign-in session has expired.'}`);
      } else {
        try {
          const response = await fetch('/api/attempts', {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Attempt history could not be loaded.');
          const localMockAttempts = localHistory
            .filter((attempt) => mockTests.some((test) => test.id === attempt.testId))
            .map((attempt) => ({
              ...attempt,
              id: attempt.id || `local-${attempt.testId}-${attempt.submittedAt}`,
              level: attempt.level || mockTests.find((test) => test.id === attempt.testId)?.level || '',
              source: 'local',
            }));
          setHistory([...localMockAttempts, ...(payload.attempts || [])].sort(
            (left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
          ));
          setAttemptError('');
        } catch (historyError) {
          setAttemptError(`Your attempted tests could not be loaded: ${historyError.message}`);
        }
      }
    }
    setLoadingTests(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingTests(false);
      setAuthReady(true);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setDataError(`Your session could not be checked: ${error.message}`);
      const currentUser = data?.session?.user || null;
      setUser(currentUser);
      setAuthReady(true);
      loadDashboardData(currentUser);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadDashboardData(session?.user || null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadDashboardData]);

  const recentAttempt = history[0];
  const filteredAttempts = useMemo(() => (
    levelFilter ? history.filter((attempt) => getAttemptLevel(attempt.level) === levelFilter) : history
  ), [history, levelFilter]);
  const averageScore = useMemo(() => {
    if (!filteredAttempts.length) return 0;
    return Math.round(filteredAttempts.reduce((sum, attempt) => (
      sum + (attempt.total ? (attempt.score / attempt.total) * 100 : 0)
    ), 0) / filteredAttempts.length);
  }, [filteredAttempts]);
  const bestScore = filteredAttempts.length
    ? Math.max(...filteredAttempts.map((attempt) => (
      attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0
    )))
    : 0;

  const openAttempt = async (attempt) => {
    if (selectedAttempt?.id === attempt.id) {
      setSelectedAttempt(null);
      return;
    }
    setAttemptError('');
    setSelectedAttempt(null);
    if (attempt.source === 'local') {
      setSelectedAttempt(attempt);
      return;
    }

    setLoadingAttemptId(attempt.id);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error(sessionError?.message || 'Your sign-in session has expired.');
      }
      const response = await fetch(`/api/attempts/${encodeURIComponent(attempt.id)}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The attempted paper could not be loaded.');
      setSelectedAttempt(payload.attempt);
    } catch (detailError) {
      setAttemptError(`The attempted paper could not be loaded: ${detailError.message}`);
    } finally {
      setLoadingAttemptId('');
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setDataError(`Sign out failed: ${error.message}`);
    else {
      setUser(null);
      setHistory([]);
      setSelectedAttempt(null);
      setAttemptError('');
      router.push('/');
    }
  };

  const allTests = [
    ...mockTests.map((test) => ({ ...test, local: true })),
    ...adminTests,
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <nav className="topbar-actions" aria-label="Main navigation">
          {user ? (
            <>
              <Link className="topbar-link" href="/queries">Queries & expert</Link>
              <Link className="topbar-link" href="/admin">Admin</Link>
              <span className="user-chip">{user.email}</span>
              <button className="button button-ghost" type="button" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="topbar-link" href="/login">Sign in</Link>
              <Link className="button button-primary" href="/signup">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <main className="page-wrap">
        {dataError && <div className="inline-alert" role="alert">{dataError}</div>}
        <section className="dashboard-hero">
          <div className="hero-copy">
            <div className="eyebrow">{user ? 'YOUR PREPARATION SPACE' : 'PRACTICE WITH PURPOSE'}</div>
            <h1 className="hero-title">{user ? `Welcome${user.email ? `, ${user.email.split('@')[0]}` : ' back'}.` : 'A clearer path to your next rank.'}</h1>
            <p className="hero-description">
              {user
                ? 'Choose a mock at your level, review every solution, and turn your practice into progress.'
                : 'Explore free and premium test series. Sign in to save your results, unlock purchased papers, and ask the community.'}
            </p>
            {!user && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                <Link className="button button-primary" href="/login">Sign in</Link>
                <Link className="button button-ghost" href="/signup">Create free account</Link>
              </div>
            )}
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Latest mock score</div>
            <div className="hero-stat-value">{recentAttempt ? `${Math.round((recentAttempt.score / recentAttempt.total) * 100)}%` : '—'}</div>
            <div className="hero-stat-caption">{recentAttempt ? recentAttempt.testTitle : 'Your first result will appear here'}</div>
          </div>
        </section>

        <section aria-label="Your progress">
          <div className="section-heading">
            <div><h2>Your progress</h2><p>Review the tests you have attempted and track your performance by level.</p></div>
            <label className="attempt-filter">
              <span>Filter by level</span>
              <select value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value); setSelectedAttempt(null); }}>
                <option value="">All attempted tests</option>
                {attemptLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
            </label>
          </div>
          {attemptError && <div className="inline-alert" role="alert">{attemptError}</div>}
          {levelFilter && (
            <div className="metric-grid attempt-metric-grid">
              <div className="metric-card"><div className="metric-label">Tests attempted</div><div className="metric-value">{filteredAttempts.length}</div><div className="metric-note">At this level</div></div>
              <div className="metric-card"><div className="metric-label">Average score</div><div className="metric-value">{filteredAttempts.length ? `${averageScore}%` : '—'}</div><div className="metric-note">Across attempts at this level</div></div>
              <div className="metric-card"><div className="metric-label">Best score</div><div className="metric-value">{filteredAttempts.length ? `${bestScore}%` : '—'}</div><div className="metric-note">Your personal best at this level</div></div>
            </div>
          )}
          {loadingTests ? (
            <div className="empty-state">Loading your attempted tests…</div>
          ) : filteredAttempts.length ? (
            <div className="attempt-list">
              {filteredAttempts.map((attempt) => {
                const percentage = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
                return (
                  <button
                    className={`attempt-card ${selectedAttempt?.id === attempt.id ? 'attempt-card-selected' : ''}`}
                    key={attempt.id}
                    type="button"
                    aria-pressed={selectedAttempt?.id === attempt.id}
                    onClick={() => openAttempt(attempt)}
                    disabled={loadingAttemptId === attempt.id}
                  >
                    <span className="attempt-card-copy">
                      <strong>{attempt.testTitle}</strong>
                      <small>{attempt.level} · {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Date unavailable'}</small>
                    </span>
                    <span className="attempt-card-score">{percentage}%<small>{attempt.score}/{attempt.total} marks</small></span>
                    <span className="attempt-card-action">{loadingAttemptId === attempt.id ? 'Loading…' : selectedAttempt?.id === attempt.id ? 'Close review' : 'Review paper →'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              {history.length
                ? 'No attempted tests match this level yet.'
                : 'No tests attempted yet. Complete a mock test and it will appear here.'}
            </div>
          )}
          {selectedAttempt && (
            <section className="attempt-detail" aria-label="Attempted paper review">
              <div className="section-heading">
                <div><div className="eyebrow">ATTEMPT REVIEW · {selectedAttempt.level}</div><h2>{selectedAttempt.testTitle}</h2><p>Complete paper, your answers, correct answers, and performance analysis.</p></div>
                <button className="button button-ghost" type="button" onClick={() => setSelectedAttempt(null)}>Close review</button>
              </div>
              {selectedAttempt.answerKey?.length ? (
                <>
                  <div className="result-metrics">
                    <article><span>Score</span><strong>{selectedAttempt.score}/{selectedAttempt.total} ({selectedAttempt.total ? Math.round((selectedAttempt.score / selectedAttempt.total) * 100) : 0}%)</strong></article>
                    <article><span>Accuracy</span><strong>{selectedAttempt.accuracy ?? '—'}%</strong></article>
                    <article><span>Correct</span><strong>{selectedAttempt.correct ?? '—'}</strong></article>
                    <article><span>Incorrect</span><strong>{selectedAttempt.wrong ?? '—'}</strong></article>
                    <article><span>Not answered</span><strong>{selectedAttempt.unanswered ?? '—'}</strong></article>
                  </div>
                  {selectedAttempt.sectionBreakdown?.length > 0 && (
                    <section className="results-section">
                      <div className="section-heading"><div><h3>Section analysis</h3><p>Your score by subject area.</p></div></div>
                      <div className="result-sections">
                        {selectedAttempt.sectionBreakdown.map((section) => (
                          <article className="result-section-card" key={section.section}>
                            <span>{section.section}</span><strong>{section.score}<small>/{section.total}</small></strong>
                            <div className="result-progress"><i style={{ width: `${section.total ? (section.score / section.total) * 100 : 0}%` }} /></div>
                            <small>{section.correct} correct</small>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                  <div className="answer-list">
                    {selectedAttempt.answerKey.map((question, index) => {
                      const selectedIndex = ['a', 'b', 'c', 'd'].indexOf(question.selected_option);
                      const correctIndex = ['a', 'b', 'c', 'd'].indexOf(question.correct_option);
                      const correct = selectedIndex >= 0 && selectedIndex === correctIndex;
                      return (
                        <article className="answer-review" key={question.id}>
                          <div className="answer-review-top">
                            <span>Q{index + 1} · {question.section} · {question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span>
                            <strong className={correct ? 'answer-correct' : 'answer-incorrect'}>{correct ? 'Correct' : selectedIndex < 0 ? 'Not answered' : 'Incorrect'}</strong>
                          </div>
                          <p className="answer-question">{question.question_text}</p>
                          <div className="answer-options">
                            {question.options.map((option, optionIndex) => (
                              <div key={`${question.id}-${optionIndex}`} className={`answer-option ${optionIndex === correctIndex ? 'answer-option-correct' : ''} ${optionIndex === selectedIndex && !correct ? 'answer-option-wrong' : ''}`}>
                                <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                                {optionIndex === correctIndex && <b>Correct answer</b>}
                                {optionIndex === selectedIndex && <b>Your answer</b>}
                              </div>
                            ))}
                          </div>
                          <div className="answer-solution"><strong>Solution</strong><p>{question.explanation}</p></div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="empty-state">This saved attempt does not include a question-by-question review. New attempts will include the full paper, your answers, and analysis.</div>
              )}
            </section>
          )}
        </section>

        <section aria-labelledby="mock-heading">
          <div className="section-heading">
            <div><h2 id="mock-heading">All test series</h2><p>Browse every free mock and premium paper available for your exam journey.</p></div>
          </div>
          <div className="level-grid">
            {allTests.map((test) => {
              const local = test.local;
              const duration = local ? test.duration : test.duration_minutes;
              const isUnlocked = test.is_free || purchasedBundles.includes(test.bundle_id);
              const bundle = Array.isArray(test.bundles) ? test.bundles[0] : test.bundles;
              const actionHref = !user
                ? `/login?next=${encodeURIComponent(isUnlocked ? `/test/${test.id}` : `/bundle/${test.bundle_id || ''}`)}`
                : isUnlocked
                  ? `/test/${test.id}`
                  : `/bundle/${test.bundle_id || ''}`;
              const actionLabel = !user
                ? 'Sign in to access →'
                : isUnlocked
                  ? (test.is_free ? 'Start free mock →' : 'Start test →')
                  : `Unlock${bundle?.price_paise ? ` · ₹${bundle.price_paise / 100}` : ''} →`;
              return (
                <article className="level-card" key={test.id}>
                  <div className="level-icon">{levelIcons[test.id] || '✦'}</div>
                  <div className={`level-pill ${test.is_free ? '' : 'premium-pill'}`}>{test.is_free ? 'Free mock' : 'Premium series'}</div>
                  <h3>{test.title}</h3>
                  <p>{test.description || 'A focused free mock test with clear solutions and performance insights.'}</p>
                  <div className="level-meta">
                    <span>{local ? test.questionCount : 'Question paper'}</span>
                    <span>{duration || 30} min</span>
                    {bundle?.name && <span>{bundle.name}</span>}
                  </div>
                  <Link
                    className={`button ${isUnlocked ? 'button-primary' : 'button-soft'} level-action`}
                    href={actionHref}
                  >
                    {actionLabel}
                  </Link>
                </article>
              );
            })}
          </div>
          {loadingTests && <div className="empty-state" style={{ marginTop: 14 }}>Loading published test series…</div>}
          {!loadingTests && !dataError && allTests.length === mockTests.length && (
            <div className="empty-state" style={{ marginTop: 14 }}>No admin-created series yet. The free government exam mocks above are ready to start.</div>
          )}
        </section>

        <section aria-labelledby="support-heading">
          <div className="section-heading">
            <div><h2 id="support-heading">You don’t have to prepare alone</h2><p>Ask the community or get personal guidance from an expert.</p></div>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon" style={{ color: '#5555c9', background: '#f0f0ff' }}>◉</div>
              <div className="feature-copy"><h3>Community queries</h3><p>Post a question, share what you’re working on, and learn with other aspirants.</p></div>
              <Link className="feature-link" href={user ? '/queries?room=community' : '/login'}>Open chat →</Link>
            </article>
            <article className="feature-card">
              <div className="feature-icon" style={{ color: '#21825a', background: '#eaf8f0' }}>✦</div>
              <div className="feature-copy"><h3>Chat with an expert</h3><p>Send your question directly to the expert team and get a focused reply.</p></div>
              <Link className="feature-link" href={user ? '/queries?room=expert' : '/login'}>Ask an expert →</Link>
            </article>
          </div>
        </section>

        {!authReady && <div className="empty-state" style={{ marginTop: 18 }}>Checking your secure session…</div>}
        {!isSupabaseConfigured && (
          <div className="inline-alert" style={{ marginTop: 22 }}>
            Email sign-in and shared features need Supabase configuration. Add the project URL and anon key to the app environment; your free mock previews are ready in the meantime.
          </div>
        )}
      </main>
    </div>
  );
}
