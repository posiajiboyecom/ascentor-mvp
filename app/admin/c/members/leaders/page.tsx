import LeadersScreen from '@/components/admin/console/LeadersScreen';
import { requireArea } from '@/lib/admin/access';
import { listLeaderInvites, SETUP_MESSAGE } from '@/lib/leader-invites';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invite a Leader' };

export default async function LeadersPage() {
  await requireArea('members', 'edit');
  const { rows, setup } = await listLeaderInvites();
  return <LeadersScreen rows={rows} setupMessage={setup ? SETUP_MESSAGE : ''} />;
}
