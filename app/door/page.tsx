// /door: Summit entrance check-in for volunteers who have no admin account. An admin turns volunteer access on in
// Admin > Entrance check-in and shares this link and the door code. See lib/summitDoor.ts.
import type { Metadata } from 'next';
import '@/styles/admin-console.css';
import { getDoorAccess, getDoorSession } from '@/lib/summitDoor';
import { checkInStats } from '@/lib/summitCheckin';
import DoorClient from './DoorClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Summit door check-in', robots: { index: false, follow: false } };

export default async function DoorPage() {
  const session = await getDoorSession().catch(() => null);
  if (!session) {
    const access = await getDoorAccess().catch(() => ({ enabled: false }));
    return <DoorClient mode="login" accessOn={access.enabled} />;
  }
  const stats = await checkInStats().catch(() => ({ checkedIn: 0, onsiteExpected: 0, walkIns: 0 }));
  return <DoorClient mode="scan" name={session.name} stats={stats} />;
}
