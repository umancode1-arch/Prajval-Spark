import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { saveAttempt } from '../../lib/attemptHistory';

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default function TestPage() {
  const router = useRouter();
  const testId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const [user, setUser] = useState(null);
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || !testId) return undefined;
    if (!isSupabaseConfigured) {
      setError('Sign-in is not configured. Add the Supabase project URL and anon key before taking a mock test.');
      setAuthReady(true);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const loadTest = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(`Your sign-in session could not be checked: ${sessionError.message}`);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
        return;
      }
      setUser(currentUser);
      setAuthReady(true);

      const response = await fetch(`/api/tests/${encodeURIComponent(testId)}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const payload = await response.json();
      if (!active) return;
      setLoading(false);
      if (!response.ok) {
        setError(payload.error || 'The question paper could not be loaded.');
        return;
      }
      setTest(payload);
      setTimeLeft((payload.duration_minutes || 30) * 60);
    };

    loadTest().catch((loadError) => {
      if (!active) return;
      setLoading(false);
      setError(`The question paper could not be loaded: ${loadError.message}`);
    });
    return () => { active = false; };
  }, [router.isReady, router.asPath, router, testId]);

  const submitTest = useCallback(async () => {
    if (!user || !test || result || submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setSubmitting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error(sessionError?.message || 'Your sign-in expired. Please sign in again.');
      }
      const response = await fetch(`/api/tests/${encodeURIComponent(test.id)}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Your answers could not be graded.');
      setResult(payload);
      if (test.local) {
        try {
          saveAttempt(user.email, {
            testId: test.id,
            testTitle: test.title,
            level: test.level,
            score: payload.score,
            total: payload.totalMarks,
            correct: payload.correct,
            attempted: payload.attempted,
            wrong: payload.wrong,
            unanswered: payload.unanswered,
            accuracy: payload.accuracy,
            sectionBreakdown: payload.sectionBreakdown,
            answerKey: payload.answerKey,
            submittedAt: new Date().toISOString(),
          });
        } catch (historyError) {
          setSaveError(`Your score is ready, but could not be saved on this device: ${historyError.message}`);
        }
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [answers, result, submitting, test, user]);

  useEffect(() => {
    if (!test || result || submitting || timerExpired) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [result, submitting, test, timerExpired]);

  useEffect(() => {
    if (!test || timeLeft > 0 || timerExpired || result || submitting) return;
    setTimerExpired(true);
    submitTest();
  }, [result, submitTest, submitting, test, timeLeft, timerExpired]);

  const sections = useMemo(() => {
    if (!test) return [];
    return [...new Set(test.questions.map((question) => question.section))];
  }, [test]);

  if (!authReady || loading) {
    return <main className="page-wrap"><div className="empty-state">Loading your secure mock test…</div></main>;
  }

  if (error && !test) {
    return <main className="page-wrap"><div className="inline-alert" role="alert">{error}</div><Link className="button button-ghost" href="/">Back to dashboard</Link></main>;
  }

  if (result) {
    return (
      <main className="page-wrap results-wrap">
        <div className="results-topline"><Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link><span className="result-complete">✓ &nbsp; MOCK COMPLETED</span></div>
        <section className="results-hero">
          <div>
            <div className="eyebrow">YOUR SCORECARD · {test.title}</div>
            <h1>Every attempt<br />is progress.</h1>
            <p>Your score, section breakdown and answer explanations are ready to review.</p>
          </div>
          <div className="result-score"><strong>{result.score}</strong><span>out of {result.totalMarks} marks</span><div>{result.totalMarks ? Math.round((result.score / result.totalMarks) * 100) : 0}% score</div></div>
        </section>
        {saveError && <div className="inline-alert" role="alert">{saveError}</div>}
        <section className="result-metrics">
          <article><span>Accuracy</span><strong>{result.accuracy}%</strong></article>
          <article><span>Correct</span><strong>{result.correct}</strong></article>
          <article><span>Incorrect</span><strong>{result.wrong}</strong></article>
          <article><span>Not answered</span><strong>{result.unanswered}</strong></article>
          <article><span>Attempted</span><strong>{result.attempted}/{test.questions.length}</strong></article>
        </section>
        <section className="results-section">
          <div className="section-heading"><div><h2>Section performance</h2><p>See where you’re strongest and where to focus next.</p></div></div>
          <div className="result-sections">
            {result.sectionBreakdown.map((section) => (
              <article className="result-section-card" key={section.section}>
                <span>{section.section}</span><strong>{section.score}<small>/{section.total}</small></strong>
                <div className="result-progress"><i style={{ width: `${section.total ? (section.score / section.total) * 100 : 0}%` }} /></div>
                <small>{section.correct} correct</small>
              </article>
            ))}
          </div>
        </section>
        <section className="results-section">
          <div className="section-heading"><div><div className="eyebrow">REVIEW & LEARN</div><h2>Answer key & solutions</h2><p>Review your choice, the correct answer, and why it works.</p></div></div>
          <div className="answer-list">
            {result.answerKey.map((question, index) => {
              const selectedIndex = ['a', 'b', 'c', 'd'].indexOf(question.selected_option);
              const correctIndex = ['a', 'b', 'c', 'd'].indexOf(question.correct_option);
              const correct = selectedIndex === correctIndex;
              return (
                <article className="answer-review" key={question.id}>
                  <div className="answer-review-top">
                    <span>Q{index + 1} · {question.section}</span>
                    <strong className={correct ? 'answer-correct' : 'answer-incorrect'}>{correct ? 'Correct' : selectedIndex < 0 ? 'Not answered' : 'Review this one'}</strong>
                  </div>
                  <p className="answer-question">{question.question_text}</p>
                  <div className="answer-options">
                    {question.options.map((option, optionIndex) => (
                      <div key={`${question.id}-${optionIndex}`} className={`answer-option ${optionIndex === correctIndex ? 'answer-option-correct' : ''} ${optionIndex === selectedIndex && !correct ? 'answer-option-wrong' : ''}`}>
                        <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                        {optionIndex === correctIndex && <b>Correct answer</b>}
                        {optionIndex === selectedIndex && !correct && <b>Your answer</b>}
                      </div>
                    ))}
                  </div>
                  <div className="answer-solution"><strong>Solution</strong><p>{question.explanation}</p></div>
                </article>
              );
            })}
          </div>
        </section>
        <Link href="/" className="button button-primary">Back to dashboard</Link>
      </main>
    );
  }

  if (!test) return null;

  const selectedCount = Object.keys(answers).length;
  const progress = test.questions.length ? (selectedCount / test.questions.length) * 100 : 0;

  return (
    <div className="shell test-shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <div className="test-top-meta"><span>{test.level}</span><span>{selectedCount}/{test.questions.length} answered</span><strong className={timeLeft < 60 ? 'timer-warning' : ''}>◷ {formatTime(timeLeft)}</strong></div>
      </header>
      <main className="page-wrap test-wrap">
        <div className="test-heading">
          <div><div className="eyebrow">FREE MOCK · {test.level}</div><h1>{test.title}</h1><p>Take your time, choose one answer per question, and submit when you’re ready.</p></div>
          <button className="button button-ghost" type="button" onClick={() => router.push('/')}>Exit test</button>
        </div>
        <div className="test-progress"><span style={{ width: `${progress}%` }} /></div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        {sections.map((section) => (
          <section className="question-section" key={section}>
            <div className="question-section-title">{section}</div>
            {test.questions.filter((question) => question.section === section).map((question) => {
              const number = test.questions.findIndex((item) => item.id === question.id) + 1;
              return (
                <article className="test-question-card" key={question.id}>
                  <div className="test-question-meta"><span>QUESTION {String(number).padStart(2, '0')}</span><span>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span></div>
                  <h2>{question.question_text}</h2>
                  <div className="test-options">
                    {question.options.map((option, optionIndex) => {
                      const key = ['a', 'b', 'c', 'd'][optionIndex];
                      const selected = answers[question.id] === key;
                      return (
                        <button type="button" key={`${question.id}-${key}`} className={`test-option ${selected ? 'selected' : ''}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: key }))}>
                          <span>{String.fromCharCode(65 + optionIndex)}</span>{option}{selected && <b>✓</b>}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
        {timerExpired && error && <p className="timer-expired">Time is up. Your answers are ready to submit once the connection is restored.</p>}
        <div className="test-submit-row">
          <span>{selectedCount < test.questions.length ? `${test.questions.length - selectedCount} unanswered` : 'All questions answered'}</span>
          <button className="button button-primary" type="button" disabled={submitting} onClick={submitTest}>{submitting ? 'Grading your mock…' : 'Submit mock test →'}</button>
        </div>
      </main>
    </div>
  );
}
