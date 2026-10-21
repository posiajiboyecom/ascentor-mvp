import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

// Signed-in members go back to Today; signed-out visitors go to the home page and can sign in
// (sending them to /dashboard would just bounce them to the login screen).
async function signedIn(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export default async function NotFound() {
  const member = await signedIn();
  return (
    <div className="rx rx-entry rx-entry-center">
      <div className="rx-card rx-entry-card-empty">
        <span className="rx-bignum">404</span>
        <p className="rx-h2">This page doesn’t exist</p>
        <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 420 }}>The link may be old, or the page moved.</p>
        <div className="rx-row" style={{ justifyContent: 'center' }}>
          {member ? (
            <>
              <Link href="/dashboard" className="rx-btn primary">Back to Today</Link>
              <Link href="/search" className="rx-btn secondary">Search</Link>
            </>
          ) : (
            <>
              <Link href="/" className="rx-btn primary">Back to home</Link>
              <Link href="/login" className="rx-btn secondary">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
