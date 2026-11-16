// /redeem?code=TES-XXXX-XXXX: the link in the Summit reward email. Signed in: use the code here.
// Signed out: the code is remembered on this device and used when they finish creating their account.
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { cleanCode } from '@/lib/rewards/access-codes';
import RedeemCode from '@/components/billing/RedeemCode';
import RememberCode from './RememberCode';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Claim your reward · Ascentor', robots: { index: false, follow: false } };

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = cleanCode((await searchParams).code).slice(0, 20);
  let signedIn = false;
  try { const db = await createClient(); signedIn = !!(await db.auth.getUser()).data.user; } catch { /* treat as signed out */ }
  const back = `/redeem${code ? `?code=${encodeURIComponent(code)}` : ''}`;

  return (
    <div className="rx rx-entry rx-entry-center">
      <div className="rx-stack-lg" style={{ width: '100%', maxWidth: 520 }}>
        <div className="rx-stack-sm" style={{ textAlign: 'center' }}>
          <p className="rx-label">The Elevation Summit 2026</p>
          <h1 className="rx-h2" style={{ margin: 0 }}>Claim your Ascentor reward</h1>
          <p className="rx-p" style={{ color: 'var(--rx-muted)' }}>Free months of Ascentor Builder: your Circle, Sage, mentor sessions and every Learn track.</p>
        </div>
        {signedIn ? (
          <RedeemCode initialCode={code} title="Your reward code" after={<Link href="/dashboard" className="rx-btn primary">Open Ascentor</Link>} />
        ) : (
          <div className="rx-card st">
            <RememberCode code={code} />
            {code && <p className="rx-p">Your code: <b style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.06em' }}>{code}</b></p>}
            <p className="rx-p">Create your free Ascentor account, or sign in if you have one. We’ll add your reward as soon as you finish setting up on this device.</p>
            <div className="rx-row" style={{ flexWrap: 'wrap' }}>
              <Link href="/signup" className="rx-btn primary">Create my account</Link>
              <Link href={`/login?redirect=${encodeURIComponent(back)}`} className="rx-btn secondary">I already have an account</Link>
            </div>
            <p className="rx-sm">Using another phone or computer? Enter the code later in Settings, then Billing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
