import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthForm from '../components/AuthForm';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const blankQuestion = () => ({
  section: 'General Awareness',
  question_text: '',
  options: ['', '', '', ''],
  correct_option: 'a',
  marks: 1,
  explanation: '',
});

const levelChoices = ['10th Pass', '12th Pass', 'Graduate'];
const sectionChoices = ['Quantitative Aptitude', 'Reasoning', 'General Awareness', 'English', 'Science'];

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [tests, setTests] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(levelChoices[0]);
  const [duration, setDuration] = useState(30);
  const [isFree, setIsFree] = useState(true);
  const [bundleId, setBundleId] = useState('');
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminContent = useCallback(async () => {
    const [testResult, bundleResult] = await Promise.all([
      supabase.from('tests').select('id,title,level,is_free,duration_minutes,created_at').order('created_at', { ascending: false }),
      supabase.from('bundles').select('id,name').order('name'),
    ]);
    if (testResult.error) setError(`Question papers could not be loaded: ${testResult.error.message}`);
    else setTests(testResult.data || []);
    if (!bundleResult.error) setBundles(bundleResult.data || []);
  }, []);

  const verifyAdmin = useCallback(async (user) => {
    setCheckingAdmin(true);
    setError('');
    const { data, error: roleError } = await supabase
      .from('exam_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    setCheckingAdmin(false);
    if (roleError) {
      throw new Error(`Admin access could not be checked. Apply the Supabase setup in supabase-schema.sql first. ${roleError.message}`);
    }
    if (!data) throw new Error('This verified email is not on the administrator list. Ask an existing project owner to provision it in Supabase.');
    setAdmin(user);
    await loadAdminContent();
  }, [loadAdminContent]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(`Your session could not be checked: ${sessionError.message}`);
      if (data.session?.user) {
        try {
          await verifyAdmin(data.session.user);
        } catch (roleError) {
          if (active) setError(roleError.message);
        }
      }
      if (active) setAuthReady(true);
    });
    return () => { active = false; };
  }, [verifyAdmin]);

  const changeQuestion = (index, changes) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...changes } : question
    )));
  };

  const changeOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const createQuestionPaper = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!questions.length || questions.some((question) => (
      !question.question_text.trim()
      || question.options.some((option) => !option.trim())
      || !question.explanation.trim()
    ))) {
      setError('Complete each question, all four options, and its solution before publishing.');
      return;
    }
    if (!isFree && !bundleId) {
      setError('Choose a bundle for a premium question paper.');
      return;
    }

    setBusy(true);
    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert({
        title: title.trim(),
        description: description.trim(),
        level,
        is_free: isFree,
        bundle_id: isFree ? null : bundleId,
        duration_minutes: Number(duration),
      })
      .select('id')
      .single();

    if (testError) {
      setBusy(false);
      setError(`The question paper could not be created: ${testError.message}`);
      return;
    }

    const questionRows = questions.map((question, index) => ({
      test_id: test.id,
      section: question.section,
      question_text: question.question_text.trim(),
      option_a: question.options[0].trim(),
      option_b: question.options[1].trim(),
      option_c: question.options[2].trim(),
      option_d: question.options[3].trim(),
      correct_option: question.correct_option,
      marks: Number(question.marks),
      explanation: question.explanation.trim(),
      order_index: index,
    }));
    const { error: questionError } = await supabase.from('questions').insert(questionRows);
    if (questionError) {
      const { error: rollbackError } = await supabase.from('tests').delete().eq('id', test.id);
      setBusy(false);
      setError(
        `The paper was created but its questions could not be saved: ${questionError.message}`
        + (rollbackError ? ` The empty paper could not be removed: ${rollbackError.message}` : '')
      );
      return;
    }

    setBusy(false);
    setTitle('');
    setDescription('');
    setDuration(30);
    setLevel(levelChoices[0]);
    setIsFree(true);
    setBundleId('');
    setQuestions([blankQuestion()]);
    setNotice('Question paper published. It is now available in the matching dashboard test list.');
    await loadAdminContent();
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Sign out failed: ${signOutError.message}`);
    else setAdmin(null);
  };

  if (!isSupabaseConfigured) {
    return <main className="page-wrap"><div className="inline-alert">Admin sign-in requires a configured Supabase project.</div><Link href="/" className="button button-ghost">Back to dashboard</Link></main>;
  }

  if (!authReady || checkingAdmin) {
    return <main className="page-wrap"><div className="empty-state">Checking administrator access…</div></main>;
  }

  if (!admin) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
          <div className="auth-visual-copy"><div className="eyebrow">ADMIN WORKSPACE</div><h2>Build the next great practice paper.</h2><p>Sign in with a verified email that has been provisioned as an exam administrator.</p></div>
          <div className="auth-perks"><span>✓ Add level-based papers</span><span>✓ Write complete solutions</span><span>✓ Review test series</span></div>
        </section>
        <section className="auth-panel-wrap">
          <div>
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <AuthForm
              mode={authMode}
              onModeChange={setAuthMode}
              title={authMode === 'reset' ? 'Reset admin password' : 'Admin sign-in'}
              subtitle={authMode === 'reset'
                ? 'Enter your administrator email to receive a password reset link.'
                : 'Sign in with the password for your provisioned administrator account.'}
              onAuthenticated={verifyAdmin}
            />
            <div style={{ textAlign: 'center' }}><Link className="back-home" href="/">← Back to dashboard</Link></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Spark Admin</Link>
        <nav className="topbar-actions">
          <Link className="topbar-link" href="/queries?room=expert">Expert inbox</Link>
          <span className="user-chip">{admin.email}</span>
          <button type="button" className="button button-ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      <main className="page-wrap">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div><div className="eyebrow">CONTENT STUDIO</div><h2 style={{ marginTop: 8 }}>Question paper builder</h2><p>Create a complete mock with marked answers and step-by-step solutions.</p></div>
        </div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        {notice && <div className="inline-alert inline-success" role="status">{notice}</div>}
        <div className="admin-grid">
          <section className="admin-card">
            <h2>New question paper</h2>
            <form onSubmit={createQuestionPaper}>
              <label className="field-label" htmlFor="paper-title">Paper title</label>
              <input id="paper-title" className="admin-field" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="e.g. Graduate Mock Test 01" />
              <label className="field-label" htmlFor="paper-description">Description</label>
              <textarea id="paper-description" className="admin-field" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="What will this mock help candidates practise?" />
              <label className="field-label" htmlFor="paper-level">Exam level</label>
              <select id="paper-level" className="admin-field" value={level} onChange={(event) => setLevel(event.target.value)}>
                {levelChoices.map((choice) => <option key={choice}>{choice}</option>)}
              </select>
              <label className="field-label" htmlFor="paper-duration">Duration in minutes</label>
              <input id="paper-duration" className="admin-field" type="number" min="1" max="300" value={duration} onChange={(event) => setDuration(event.target.value)} required />
              <label className="field-label" htmlFor="paper-access">Access</label>
              <select id="paper-access" className="admin-field" value={isFree ? 'free' : 'premium'} onChange={(event) => setIsFree(event.target.value === 'free')}>
                <option value="free">Free mock</option><option value="premium">Premium bundle</option>
              </select>
              {!isFree && (
                <>
                  <label className="field-label" htmlFor="bundle-id">Bundle ID</label>
                  {bundles.length ? (
                    <select id="bundle-id" className="admin-field" value={bundleId} onChange={(event) => setBundleId(event.target.value)} required>
                      <option value="">Choose a bundle</option>
                      {bundles.map((bundle) => <option value={bundle.id} key={bundle.id}>{bundle.name}</option>)}
                    </select>
                  ) : (
                    <input id="bundle-id" className="admin-field" value={bundleId} onChange={(event) => setBundleId(event.target.value)} required placeholder="Paste an existing bundle UUID" />
                  )}
                </>
              )}
              <button className="button button-primary" type="submit" disabled={busy || !title.trim()}>{busy ? 'Publishing…' : 'Publish question paper'}</button>
            </form>
          </section>

          <section className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Questions <span style={{ color: '#8993a7', fontSize: 12 }}>({questions.length})</span></h2>
              <button className="button button-soft" type="button" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>＋ Add question</button>
            </div>
            {questions.map((question, index) => (
              <article className="question-editor" key={`question-${index}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <h3>Question {index + 1}</h3>
                  {questions.length > 1 && <button type="button" className="text-action" style={{ margin: 0 }} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
                </div>
                <select className="admin-field" aria-label={`Section for question ${index + 1}`} value={question.section} onChange={(event) => changeQuestion(index, { section: event.target.value })}>
                  {sectionChoices.map((choice) => <option key={choice}>{choice}</option>)}
                </select>
                <textarea className="admin-field" aria-label={`Question ${index + 1} text`} rows={2} value={question.question_text} onChange={(event) => changeQuestion(index, { question_text: event.target.value })} placeholder="Write the question…" />
                <div className="admin-options-grid">
                  {question.options.map((option, optionIndex) => (
                    <input
                      className="admin-field"
                      key={`option-${optionIndex}`}
                      aria-label={`Question ${index + 1}, option ${String.fromCharCode(65 + optionIndex)}`}
                      value={option}
                      onChange={(event) => changeOption(index, optionIndex, event.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />
                  ))}
                </div>
                <div className="admin-inline-fields">
                  <label className="field-label">Correct answer
                    <select className="admin-field" value={question.correct_option} onChange={(event) => changeQuestion(index, { correct_option: event.target.value })}>
                      {['a', 'b', 'c', 'd'].map((option, optionIndex) => <option value={option} key={option}>Option {String.fromCharCode(65 + optionIndex)}</option>)}
                    </select>
                  </label>
                  <label className="field-label">Marks
                    <input className="admin-field" type="number" min="1" max="100" value={question.marks} onChange={(event) => changeQuestion(index, { marks: event.target.value })} />
                  </label>
                </div>
                <textarea className="admin-field" aria-label={`Solution for question ${index + 1}`} rows={3} value={question.explanation} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} placeholder="Explain why the answer is correct…" />
              </article>
            ))}
          </section>

          <section className="admin-card admin-list">
            <h2>Published papers</h2>
            {tests.length ? tests.map((test) => (
              <div className="admin-test-row" key={test.id}>
                <div><strong>{test.title}</strong><br /><span>{test.level} · {test.duration_minutes} min</span></div>
                <span>{test.is_free ? 'FREE' : 'PREMIUM'}</span>
              </div>
            )) : <div className="empty-state">No question papers created yet.</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
