import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { saveAttempt } from '../../lib/attemptHistory';
import { normalizeTetSection } from '../../lib/tetSections';

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default function TestPage() {
  const router = useRouter();
  const testId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const [user, setUser] = useState(null);
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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
  const currentQuestion = test.questions[currentQuestionIndex];
  const currentQuestionMarked = Boolean(markedForReview[currentQuestion.id]);
  const isTetTest = /\btet\b|teacher eligibility test/i.test(`${test.id} ${test.title} ${test.level}`);
  const currentSectionName = isTetTest
    ? normalizeTetSection(currentQuestion.section)
    : currentQuestion.section;
  const nextQuestion = test.questions[currentQuestionIndex + 1];
  const nextSectionName = nextQuestion && (isTetTest
    ? normalizeTetSection(nextQuestion.section)
    : nextQuestion.section);
  const nextStartsSection = Boolean(nextQuestion && nextSectionName !== currentSectionName);
  const sectionGroups = test.questions.reduce((groups, question, index) => {
    const sectionName = isTetTest
      ? normalizeTetSection(question.section || 'Questions')
      : question.section || 'Questions';
    let group = groups.find((item) => item.name === sectionName);
    if (!group) {
      group = { name: sectionName, questions: [] };
      groups.push(group);
    }
    group.questions.push({ question, index });
    return groups;
  }, []);
  const currentSectionGroup = sectionGroups.find((group) => group.name === currentSectionName);
  const currentSectionGroupIndex = sectionGroups.findIndex((group) => group.name === currentSectionName);

  return (
    <div className="shell test-shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <div className="test-top-meta"><span>{test.level}</span><span>{selectedCount}/{test.questions.length} answered</span></div>
      </header>
      <main className="page-wrap test-wrap">
        <div className="test-heading">
          <div><div className="eyebrow">FREE MOCK · {test.level}</div><h1>{test.title}</h1><p>Take your time, choose one answer per question, and submit when you’re ready.</p></div>
          <div className="test-heading-actions">
            <span>{selectedCount < test.questions.length ? `${test.questions.length - selectedCount} unanswered` : 'All questions answered'}</span>
            <button className="button button-primary" type="button" disabled={submitting} onClick={submitTest}>{submitting ? 'Grading your mock…' : 'Submit mock test'}</button>
            <button className="button button-ghost" type="button" onClick={() => router.push('/')}>Exit test</button>
          </div>
        </div>
        <div className="test-progress"><span style={{ width: `${progress}%` }} /></div>
        <section className="mobile-test-tools" aria-label="Test timer and question navigation">
          <div className="mobile-test-timer">
            <span>TIME LEFT</span>
            <strong className={timeLeft < 60 ? 'timer-warning' : ''}>{formatTime(timeLeft)}</strong>
            <small>{selectedCount}/{test.questions.length} answered</small>
          </div>
          <div className="mobile-question-nav">
            <div className="mobile-section-tabs" role="tablist" aria-label="Test sections">
              {sectionGroups.map((group, groupIndex) => {
                const active = group.name === currentSectionName;
                return (
                  <button
                    type="button"
                    role="tab"
                    key={group.name}
                    id={`mobile-section-tab-${groupIndex}`}
                    className={`mobile-section-tab ${active ? 'mobile-section-tab-active' : ''}`}
                    aria-selected={active}
                    aria-controls="mobile-section-questions"
                    onClick={() => setCurrentQuestionIndex(group.questions[0].index)}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
            <h2><span>{currentSectionName}</span><span>{currentSectionGroup?.questions.length || 0}</span></h2>
            <div
              className="mobile-question-strip"
              key={currentSectionName}
              id="mobile-section-questions"
              role="tabpanel"
              aria-labelledby={`mobile-section-tab-${currentSectionGroupIndex}`}
              aria-label={`${currentSectionName} questions`}
            >
              {currentSectionGroup?.questions.map(({ question, index }) => {
                const status = markedForReview[question.id] ? 'review' : answers[question.id] ? 'answered' : 'unanswered';
                return (
                  <button
                    type="button"
                    key={question.id}
                    className={`question-number question-number-${status} ${index === currentQuestionIndex ? 'question-number-current' : ''}`}
                    aria-label={`Question ${index + 1}, ${status}${index === currentQuestionIndex ? ', current question' : ''}`}
                    aria-current={index === currentQuestionIndex ? 'step' : undefined}
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <div className="test-layout">
          <section className="question-section" aria-label="Current question">
            <div className="question-section-title">{currentSectionName}</div>
            <article className="test-question-card" key={currentQuestion.id}>
              <div className="test-question-meta">
                <span>QUESTION {String(currentQuestionIndex + 1).padStart(2, '0')} OF {String(test.questions.length).padStart(2, '0')}</span>
                <span>{currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}</span>
              </div>
              <h2>{currentQuestion.question_text}</h2>
              <div className="test-options">
                {currentQuestion.options.map((option, optionIndex) => {
                  const key = ['a', 'b', 'c', 'd'][optionIndex];
                  const selected = answers[currentQuestion.id] === key;
                  return (
                    <button type="button" key={`${currentQuestion.id}-${key}`} className={`test-option ${selected ? 'selected' : ''}`} onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: key }))}>
                      <span>{String.fromCharCode(65 + optionIndex)}</span>{option}{selected && <b>✓</b>}
                    </button>
                  );
                })}
              </div>
            </article>
            <div className="question-actions">
              <div className="question-review-action">
                <button
                  className={`button ${currentQuestionMarked ? 'button-review-marked' : 'button-ghost'}`}
                  type="button"
                  aria-pressed={currentQuestionMarked}
                  onClick={() => setMarkedForReview((current) => ({ ...current, [currentQuestion.id]: !current[currentQuestion.id] }))}
                >
                  {currentQuestionMarked ? '✓ Marked for review' : 'Mark for review'}
                </button>
              </div>
              <div className="question-navigation">
                <button className="button button-ghost" type="button" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex((index) => index - 1)}>← Previous</button>
                <button className="button button-primary" type="button" disabled={currentQuestionIndex === test.questions.length - 1} onClick={() => setCurrentQuestionIndex((index) => index + 1)}>{nextStartsSection ? 'Next section →' : 'Next →'}</button>
              </div>
            </div>
          </section>
          <aside className="test-sidebar" aria-label="Test navigation">
            <section className="test-side-card test-timer-card">
              <span>TIME LEFT</span>
              <strong className={timeLeft < 60 ? 'timer-warning' : ''}>{formatTime(timeLeft)}</strong>
              <small>{selectedCount} of {test.questions.length} answered</small>
            </section>
            <section className="test-side-card">
              <h2>Questions by section</h2>
              <div className="question-section-list" aria-label="Question navigation by section">
                {sectionGroups.map((group) => (
                  <section className="question-palette-section" key={group.name} aria-label={group.name}>
                    <h3>
                      <span>{group.name}</span>
                      <span className="question-palette-count" aria-label={`${group.questions.length} questions`}>
                        {group.questions.length}
                      </span>
                    </h3>
                    <div className="question-palette">
                      {group.questions.map(({ question, index }) => {
                        const status = markedForReview[question.id] ? 'review' : answers[question.id] ? 'answered' : 'unanswered';
                        return (
                          <button
                            type="button"
                            key={question.id}
                            className={`question-number question-number-${status} ${index === currentQuestionIndex ? 'question-number-current' : ''}`}
                            aria-label={`Question ${index + 1}, ${group.name}, ${status}${index === currentQuestionIndex ? ', current question' : ''}`}
                            aria-current={index === currentQuestionIndex ? 'step' : undefined}
                            onClick={() => setCurrentQuestionIndex(index)}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <ul className="question-status-legend">
                <li><i className="legend-answered" />Answered</li>
                <li><i className="legend-unanswered" />Not answered</li>
                <li><i className="legend-review" />Marked for review</li>
              </ul>
            </section>
            {timerExpired && error && <p className="timer-expired">Time is up. Your answers are ready to submit once the connection is restored.</p>}
          </aside>
        </div>
      </main>
    </div>
  );
}
