import CheckInScreen from '@/components/admin/console/CheckInScreen';
import { requireArea } from '@/lib/admin/access';
import { checkInStats } from '@/lib/summitCheckin';
import { getDoorAccess } from '@/lib/summitDoor';
import { getWalkInMode } from '@/lib/summitWalkIn';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrance check-in' };

export default async function CheckInPage() {
  const staff = await requireArea('checkin', 'view');
  const stats = await checkInStats().catch(() => ({ checkedIn: 0, onsiteExpected: 0, walkIns: 0 }));
  const level = staff.uiLevel('checkin');
  // Only Full can see and change volunteer access (the door code).
  const door = level === 'full' ? await getDoorAccess().then((a) => ({ enabled: a.enabled, code: a.code })).catch(() => ({ enabled: false, code: '' })) : undefined;
  const walkIn = level === 'full' ? await getWalkInMode().catch(() => 'auto' as const) : undefined;
  return <CheckInScreen initialStats={stats} canAdmit={level === 'edit' || level === 'full'} door={door} walkIn={walkIn} />;
}
