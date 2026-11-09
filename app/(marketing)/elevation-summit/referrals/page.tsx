// Public referral leaderboard for The Elevation Summit: who has brought the most friends. Refreshes every 5 minutes.
import '@/styles/marketing.css';
import type { Metadata } from 'next';
import { REFERRAL_GOAL, loadPublicBoard, type PublicBoard } from '@/lib/summitReferralPublic';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Referral leaderboard · The Elevation Summit',
  description: `Who is bringing the most people to The Elevation Summit, 19 November 2026 at LASU, Ojo. Bring ${REFERRAL_GOAL} friends to win a prize.`,
  alternates: { canonical: '/elevation-summit/referrals' },
  openGraph: {
    title: 'Elevation Summit referral leaderboard',
    description: `Bring ${REFERRAL_GOAL} friends to The Elevation Summit and win a prize. See who is leading.`,
    url: '/elevation-summit/referrals',
  },
};

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8E6E1', borderRadius: '1rem' };
const medal = ['#C8A84B', '#A8A9AD', '#B87333'];

export default async function SummitReferralsPage() {
  let board: PublicBoard | null = null;
  try { board = await loadPublicBoard(); } catch (e) { console.error('[summit/referrals] load failed:', e); }

  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(6rem, 12vw, 9rem) 1rem 5rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="mkt-gold-bar" style={{ margin: '0 auto 1.5rem' }} />
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>The Elevation Summit · 19 November 2026</p>
          <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>Referral leaderboard</h1>
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.7, margin: '0 auto 2rem', maxWidth: 560 }}>
            Bring {REFERRAL_GOAL} friends to the Summit and win a prize. Top referrers are celebrated at the event.
          </p>
        </div>

        {board && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              [String(board.totalConfirmed), 'friends brought'],
              [String(board.referrers), board.referrers === 1 ? 'person referring' : 'people referring'],
              [String(board.reachedCount), `reached ${REFERRAL_GOAL}`],
            ].map(([v, l]) => (
              <div key={l} style={{ ...card, padding: '1rem', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0F0F0E' }}>{v}</p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6B7280' }}>{l}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...card, overflow: 'hidden', marginBottom: '2rem' }}>
          {!board ? (
            <p style={{ padding: '1.5rem', margin: 0, color: '#6B7280', textAlign: 'center' }}>The leaderboard is updating. Check back in a few minutes.</p>
          ) : board.leaders.length === 0 ? (
            <p style={{ padding: '1.5rem', margin: 0, color: '#6B7280', textAlign: 'center' }}>No confirmed referrals yet. Share your link and be the first name here.</p>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {board.leaders.map((l, i) => {
                const pct = Math.min(100, Math.round((l.confirmed / REFERRAL_GOAL) * 100));
                return (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', borderTop: i ? '1px solid #F0EEE9' : 0 }}>
                    <span aria-label={`Place ${l.rank}`} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.875rem', background: l.rank <= 3 ? medal[l.rank - 1] : '#F3F1EC', color: l.rank <= 3 ? '#fff' : '#4B5563' }}>{l.rank}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 0.375rem', fontWeight: 700, color: '#0F0F0E', overflowWrap: 'anywhere' }}>{l.name}</p>
                      <div aria-hidden style={{ height: 6, borderRadius: 3, background: '#EFECE6', overflow: 'hidden', maxWidth: 260 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: l.reached ? '#1E6B34' : '#C8A84B' }} />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 800, color: '#0F0F0E' }}>{l.confirmed}</p>
                      {l.reached
                        ? <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#1E6B34' }}>Prize unlocked</p>
                        : <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>{REFERRAL_GOAL - l.confirmed} to go</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div style={{ ...card, padding: '1.5rem', marginBottom: '2rem' }}>
          <p style={{ color: '#0F0F0E', fontWeight: 700, margin: '0 0 0.75rem' }}>How it works</p>
          <ol style={{ color: '#4B5563', fontSize: '0.9375rem', lineHeight: 1.7, margin: 0, paddingLeft: '1.25rem' }}>
            <li>Register for the Summit (it is free). You get your own referral link.</li>
            <li>Share the link with friends. Each friend who registers with it and confirms their email counts for you.</li>
            <li>Reach {REFERRAL_GOAL} and you win a prize, given at the Summit.</li>
          </ol>
          <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', lineHeight: 1.6, margin: '0.75rem 0 0' }}>
            Names show as first name and last initial. The board refreshes every few minutes. Signups that look duplicated are checked before they count.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/elevation-summit#register" className="btn-gold" style={{ display: 'inline-flex' }}>Register and get my link</a>
          <a href="/elevation-summit/ticket" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.875rem 1.5rem', borderRadius: '0.625rem', border: '1.5px solid #E8E6E1', color: '#0F0F0E', fontWeight: 600, textDecoration: 'none' }}>Already registered? Find my link</a>
        </div>
      </div>
    </main>
  );
}
