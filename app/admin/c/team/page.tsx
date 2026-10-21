import TeamScreen from '@/components/admin/console/TeamScreen';
import { loadRoles, requireArea } from '@/lib/admin/access';
import { listStaff } from '@/lib/admin/staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team and access' };

export default async function TeamPage() {
  const staff = await requireArea('team', 'view');
  const [team, roles] = await Promise.all([listStaff(staff.userId), loadRoles()]);
  return (
    <TeamScreen
      team={team}
      roles={roles}
      canEdit={staff.uiLevel('team') === 'edit' || staff.uiLevel('team') === 'full'}
      isAdmin={staff.isAdmin}
    />
  );
}
