import Link from 'next/link';
import { useRouter } from 'next/router';
import AuthForm from '../components/AuthForm';

export default function Signup() {
  const router = useRouter();

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link href="/" className="brand-mark"><span className="brand-symbol">✦</span> Prajval Spark</Link>
        <div className="auth-visual-copy">
          <div className="eyebrow">A smarter way to prepare</div>
          <h2>Your exam goals deserve a real plan.</h2>
          <p>Start with a free mock at your level, understand every answer, and keep your progress moving forward.</p>
        </div>
        <div className="auth-perks"><span>✓ Free mock tests</span><span>✓ Detailed solutions</span><span>✓ Progress that stays yours</span></div>
      </section>
      <section className="auth-panel-wrap">
        <div>
          <AuthForm
            mode="signup"
            title="Create your account"
            subtitle="Create your account with an email address and a password of at least 8 characters."
            onAuthenticated={() => router.push('/')}
          />
          <div style={{ textAlign: 'center' }}>
            <Link className="back-home" href="/login">Already have an account? Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
