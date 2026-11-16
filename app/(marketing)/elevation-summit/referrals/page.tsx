// Public referral leaderboard for The Elevation Summit: who has brought the most friends.
import '@/styles/marketing.css';
import '@/styles/summit-leaderboard.css';
import type { Metadata } from 'next';
import { REFERRAL_GOAL, loadPublicBoard, type PublicBoard } from '@/lib/summitReferralPublic';
import { CELEBRATE_FROM } from '@/lib/summitReferralPublicTypes';
import LeaderboardView from './LeaderboardView';
import { SUMMIT, SUMMIT_OG_IMAGE } from '@/lib/seo';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Referral leaderboard · The Elevation Summit',
  description: `Who is bringing the most people to The Elevation Summit, 19 November 2026 at Lagos State University, Ojo. Bring ${REFERRAL_GOAL} friends to win a prize.`,
  alternates: { canonical: '/elevation-summit/referrals' },
  openGraph: {
    title: 'Elevation Summit referral leaderboard',
    description: `Bring ${REFERRAL_GOAL} friends to The Elevation Summit and win a prize. See who is leading.`,
    url: '/elevation-summit/referrals',
    images: [SUMMIT_OG_IMAGE],
  },
};

// ?celebrate=1 previews the Summit-day celebration before the day.
export default async function SummitReferralsPage({ searchParams }: { searchParams: Promise<{ celebrate?: string }> }) {
  let board: PublicBoard | null = null;
  try { board = await loadPublicBoard(); } catch (e) { console.error('[summit/referrals] load failed:', e); }
  const days = Math.max(0, Math.ceil((new Date(SUMMIT.startDate).getTime() - Date.now()) / 86_400_000));
  const celebrate = Date.now() >= new Date(CELEBRATE_FROM).getTime() || (await searchParams).celebrate === '1';
  return <LeaderboardView board={board} days={days} celebrate={celebrate} />;
}
