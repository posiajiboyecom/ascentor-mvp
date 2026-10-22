import GroupsScreen from '@/components/admin/console/GroupsScreen';
import { requireArea } from '@/lib/admin/access';
import { loadGroups } from '@/lib/admin/billing-admin-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Groups' };

export default async function GroupsPage() {
  const staff = await requireArea('members', 'view');
  const { rows, note } = await loadGroups();
  return <GroupsScreen rows={rows} note={note} level={staff.uiLevel('members')} />;
}
