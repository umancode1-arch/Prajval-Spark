import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export default function QueriesPage() {
  const router = useRouter();
  const requestedRoom = Array.isArray(router.query.room) ? router.query.room[0] : router.query.room;
  const requestedThread = Array.isArray(router.query.thread) ? router.query.thread[0] : router.query.thread;
  const room = requestedRoom === 'expert' ? 'expert' : 'community';
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const messageEndRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('student_messages')
      .select('id,user_id,thread_user_id,room,body,is_expert,created_at')
      .eq('room', room);
    if (room === 'expert' && !isAdmin) query = query.eq('thread_user_id', user.id);
    const result = await query.order('created_at', { ascending: true });
    setLoading(false);
    if (result.error) {
      setError(`Messages could not be loaded. Apply the Supabase setup in supabase-schema.sql first. ${result.error.message}`);
      return;
    }
    setError('');
    setMessages(result.data || []);
  }, [isAdmin, room, user]);

  useEffect(() => {
    if (!router.isReady) return undefined;
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(`Your session could not be checked: ${sessionError.message}`);
      const currentUser = data.session?.user || null;
      if (!currentUser) {
        setAuthReady(true);
        return;
      }
      setUser(currentUser);
      const { data: role, error: roleError } = await supabase
        .from('exam_admins')
        .select('user_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!active) return;
      if (roleError) setError(`Expert permissions could not be checked: ${roleError.message}`);
      setIsAdmin(Boolean(role));
      setAuthReady(true);
    });
    return () => { active = false; };
  }, [router.isReady]);

  useEffect(() => {
    if (!user) return undefined;
    loadMessages();
    const channel = supabase
      .channel(`student-messages-${room}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_messages',
        filter: `room=eq.${room}`,
      }, loadMessages)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadMessages, room, user]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const conversations = useMemo(() => {
    if (!isAdmin || room !== 'expert') return [];
    const byThread = new Map();
    messages.forEach((message) => {
      if (!message.thread_user_id) return;
      const previous = byThread.get(message.thread_user_id);
      if (!previous || new Date(message.created_at) > new Date(previous.created_at)) {
        byThread.set(message.thread_user_id, message);
      }
    });
    return [...byThread.entries()]
      .map(([id, latest]) => ({ id, latest }))
      .sort((left, right) => new Date(right.latest.created_at) - new Date(left.latest.created_at));
  }, [isAdmin, messages, room]);

  const currentThreadId = room !== 'expert'
    ? null
    : isAdmin
      ? conversations.some((conversation) => conversation.id === requestedThread)
        ? requestedThread
        : conversations[0]?.id || ''
      : user?.id;
  const visibleMessages = isAdmin && room === 'expert' && currentThreadId
    ? messages.filter((message) => message.thread_user_id === currentThreadId)
    : messages;

  const submitMessage = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !user || sending) return;
    setError('');
    setNotice('');
    setSending(true);
    const { error: insertError } = await supabase.from('student_messages').insert({
      user_id: user.id,
      room,
      thread_user_id: room === 'expert' ? currentThreadId : null,
      body,
      is_expert: room === 'expert' && isAdmin,
    });
    setSending(false);
    if (insertError) {
      setError(`Your message could not be posted: ${insertError.message}`);
      return;
    }
    setDraft('');
    if (room === 'expert' && !isAdmin) setNotice('Your question has been sent to the expert team.');
    await loadMessages();
  };

  const roomInfo = useMemo(() => room === 'expert'
    ? { title: 'Chat with an expert', subtitle: 'Share your question privately with the expert team.', icon: '✦' }
    : { title: 'Community queries', subtitle: 'Ask the community and learn together.', icon: '◉' }, [room]);

  if (!isSupabaseConfigured) {
    return <main className="page-wrap"><div className="inline-alert">Shared chat requires a configured Supabase project.</div><Link href="/login" className="button button-primary">Sign in</Link></main>;
  }

  if (!authReady) return <main className="page-wrap"><div className="empty-state">Checking your secure sign-in…</div></main>;

  if (!user) {
    return (
      <main className="page-wrap" style={{ maxWidth: 700 }}>
        <section className="admin-card" style={{ textAlign: 'center', padding: 38 }}>
          <div className="level-icon" style={{ margin: '0 auto 16px' }}>◉</div>
          <h1 style={{ fontFamily: 'Manrope,sans-serif' }}>Join the conversation</h1>
          <p style={{ color: '#7b879f', lineHeight: 1.7 }}>Sign in with your email to post questions, join the community, and chat with an expert.</p>
          <Link className="button button-primary" href={`/login?next=${encodeURIComponent(`/queries?room=${room}`)}`}>Sign in to continue</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <nav className="topbar-actions"><Link className="topbar-link" href="/">Dashboard</Link>{isAdmin && <Link className="topbar-link" href="/admin">Admin studio</Link>}<span className="user-chip">{user.email}</span></nav>
      </header>
      <main className="page-wrap">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div><div className="eyebrow">STUDY TOGETHER</div><h1 style={{ margin: '8px 0 0', font: '800 26px Manrope,sans-serif' }}>Questions are better when shared.</h1><p>Connect with fellow aspirants or get focused help from our experts.</p></div>
        </div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        {notice && <div className="inline-alert inline-success" role="status">{notice}</div>}
        <section className="chat-layout" aria-label="Student chat">
          <aside className="chat-sidebar">
            <button type="button" className={`chat-choice ${room === 'community' ? 'active' : ''}`} onClick={() => router.push('/queries?room=community', undefined, { shallow: true })}>
              <span className="chat-choice-icon">◉</span><span><strong>Community</strong><small>Learn with other aspirants</small></span>
            </button>
            <button type="button" className={`chat-choice ${room === 'expert' ? 'active' : ''}`} onClick={() => router.push('/queries?room=expert', undefined, { shallow: true })}>
              <span className="chat-choice-icon">✦</span><span><strong>Chat with an expert</strong><small>Get guidance from the team</small></span>
            </button>
            {isAdmin && room === 'expert' && (
              <div className="conversation-list">
                <div className="conversation-list-title">STUDENT CONVERSATIONS</div>
                {conversations.length ? conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    className={`conversation-choice ${conversation.id === currentThreadId ? 'active' : ''}`}
                    onClick={() => router.push(`/queries?room=expert&thread=${conversation.id}`, undefined, { shallow: true })}
                  >
                    <strong>Aspirant {conversation.id.slice(0, 8)}</strong>
                    <small>{conversation.latest.body}</small>
                  </button>
                )) : <p className="conversation-empty">No student questions yet.</p>}
              </div>
            )}
          </aside>
          <div className="chat-main">
            <header className="chat-heading"><h2>{roomInfo.icon} &nbsp;{roomInfo.title}</h2><p>{roomInfo.subtitle}{room === 'expert' && !isAdmin ? ' Our team will reply here.' : ''}</p></header>
            <div className="chat-messages" aria-live="polite">
              {loading && !visibleMessages.length && <div className="empty-state">Loading conversation…</div>}
              {!loading && !visibleMessages.length && (
                <div className="empty-state">{room === 'expert' ? 'Start by describing what you need help with. An expert will reply in this conversation.' : 'The conversation starts with you. Share a question or helpful tip with the community.'}</div>
              )}
              {visibleMessages.map((message) => {
                const mine = message.user_id === user.id;
                return (
                  <article key={message.id} className={`chat-message ${mine ? 'mine' : ''} ${message.is_expert ? 'expert' : ''}`}>
                    <div className="message-meta">
                      {message.is_expert ? '✦ Expert' : mine ? 'You' : 'Aspirant'}
                      {' · '}{new Date(message.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="message-body">{message.body}</div>
                  </article>
                );
              })}
              <div ref={messageEndRef} />
            </div>
            <form className="chat-composer" onSubmit={submitMessage}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                maxLength={4000}
                rows={2}
                placeholder={room === 'expert' && isAdmin ? (currentThreadId ? 'Write a helpful expert response…' : 'Select a student conversation to reply…') : 'Type your question or message…'}
                aria-label="Your message"
                required
              />
              <button type="submit" className="button button-primary" disabled={sending || !draft.trim() || (room === 'expert' && isAdmin && !currentThreadId)}>{sending ? 'Sending…' : 'Send'}</button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
