import Link from 'next/link';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export default function NotFound() {
  return (
    <div className="rx rx-entry rx-entry-center">
      <div className="rx-card rx-entry-card-empty">
        <span className="rx-bignum">404</span>
        <p className="rx-h2">This page doesn’t exist</p>
        <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 420 }}>The link may be old, or the page moved.</p>
        <div className="rx-row" style={{ justifyContent: 'center' }}>
          <Link href="/dashboard" className="rx-btn primary">Back to Today</Link>
          <Link href="/search" className="rx-btn secondary">Search</Link>
        </div>
      </div>
    </div>
  );
}
