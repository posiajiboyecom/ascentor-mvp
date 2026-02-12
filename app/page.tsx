import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg text-center animate-fade-up">
        <div className="text-5xl mb-5">⬆</div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-3"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)', lineHeight: 1.15 }}>
          Welcome to <span style={{ color: 'var(--accent)' }}>Ascentor</span>
        </h1>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Your AI-powered leadership coach, built for ambitious African professionals ready to lead.
        </p>

        <div className="flex gap-3 justify-center flex-wrap mb-10">
          {['AI Coaching 24/7', 'Expert Sessions', 'Peer Cohorts'].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(20, 184, 166, 0.09)',
                color: 'var(--teal)',
                border: '1px solid rgba(20, 184, 166, 0.19)',
              }}>
              {f}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup"
            className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-colors text-center"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Get Started →
          </Link>
          <Link href="/login"
            className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-colors text-center"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
