import CheckInScreen from '@/components/admin/console/CheckInScreen';
import { requireArea } from '@/lib/admin/access';
import { checkInStats } from '@/lib/summitCheckin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrance check-in' };

export default async function CheckInPage() {
  const staff = await requireArea('checkin', 'view');
  const stats = await checkInStats().catch(() => ({ checkedIn: 0, onsiteExpected: 0, walkIns: 0 }));
  const level = staff.uiLevel('checkin');
  return <CheckInScreen initialStats={stats} canAdmit={level === 'edit' || level === 'full'} />;
}
