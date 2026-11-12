// /walk-in: self check-in for people who arrive at The Elevation Summit without registering. Linked from the QR poster
// at the entrance. See lib/summitWalkIn.ts.
import type { Metadata } from 'next';
import { walkInOpen } from '@/lib/summitWalkIn';
import WalkInClient from './WalkInClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Check in: The Elevation Summit',
  description: 'Walk-in check-in for The Elevation Summit.',
  robots: { index: false, follow: false },
};

export default async function WalkInPage() {
  const open = await walkInOpen().catch(() => false);
  return <WalkInClient open={open} />;
}
