import Link from 'next/link';
import { requireArea } from '@/lib/admin/access';
import { loadReferrals } from '@/lib/summitReferralAdmin';
import ReviewButtons from './ReviewButtons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Summit referrals' };

const cell = { padding: '8px 10px', borderBottom: '1px solid #e8e6e1', textAlign: 'left' as const, whiteSpace: 'nowrap' as const };

/** The referral prize target: 10 confirmed referrals. */
const GOAL = 10;

function Milestone({ n }: { n: number }) {
  if (n >= GOAL) return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: '#E7F3EA', color: '#1E6B34', fontSize: 12, fontWeight: 700 }}>Reached ✓</span>;
  const pct = Math.round((n / GOAL) * 100);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden style={{ width: 60, height: 6, borderRadius: 3, background: '#E8E6E1', overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#C8A84B' }} /></span>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{n}/{GOAL} · {GOAL - n} to go</span>
    </span>
  );
}

export default async function Page() {
  const staff = await requireArea('registrations', 'view');
  const level = staff.uiLevel('registrations');
  const canReview = level === 'edit' || level === 'full';
  let data: Awaited<ReturnType<typeof loadReferrals>> | null = null;
  try { data = await loadReferrals(); } catch (e) { console.error('[admin/referrals] load failed:', e); }
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 64px' }}>
      <Link href="/admin/c/registrations" style={{ fontSize: 14 }}>← Registrations</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '12px 0 4px' }}>Summit referrals</h1>
      <p style={{ opacity: 0.75, margin: '0 0 20px' }}>A referral counts as soon as the friend registers. Suspicious signups are held below for review. Ranked by referrals who attended, then by confirmed referrals.</p>
      {!data ? <p role="alert">We could not load referrals. Has the referrals migration been applied?</p> : (<>
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Leaderboard</h2>
        <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 8px' }}>{data.leaders.filter((l) => l.verified >= GOAL).length} {data.leaders.filter((l) => l.verified >= GOAL).length === 1 ? 'person has' : 'people have'} reached {GOAL} confirmed referrals.</p>
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', display: 'table' }}>
            <thead><tr>{['#', 'Name', 'Email', 'Confirmed', 'Attended', 'Pending', 'Flagged', `Goal (${GOAL})`].map((h) => <th key={h} style={{ ...cell, fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>{h}</th>)}</tr></thead>
            <tbody>{data.leaders.length === 0 ? <tr><td style={cell} colSpan={8}>No referrals yet.</td></tr> : data.leaders.map((l, i) => (
              <tr key={l.id}><td style={cell}>{i + 1}</td><td style={{ ...cell, fontWeight: 600 }}>{l.name}</td><td style={cell}>{l.email}</td><td style={cell}>{l.verified}</td><td style={cell}>{l.attended}</td><td style={cell}>{l.pending}</td><td style={cell}>{l.flagged}</td><td style={cell}><Milestone n={l.verified} /></td></tr>
            ))}</tbody>
          </table>
        </div>
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Held for review ({data.flagged.length})</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', display: 'table' }}>
            <thead><tr>{['Referrer', 'Friend', 'Why held', ''].map((h) => <th key={h} style={{ ...cell, fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>{h}</th>)}</tr></thead>
            <tbody>{data.flagged.length === 0 ? <tr><td style={cell} colSpan={4}>Nothing waiting.</td></tr> : data.flagged.map((f) => (
              <tr key={f.id}><td style={cell}>{f.referrer}</td><td style={cell}>{f.friend}<br /><span style={{ opacity: 0.65, fontSize: 12 }}>{f.friendEmail}</span></td><td style={{ ...cell, whiteSpace: 'normal' }}>{f.reason}</td><td style={cell}>{canReview ? <ReviewButtons id={f.id} /> : null}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}
