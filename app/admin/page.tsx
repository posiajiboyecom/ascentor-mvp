// Admin Overview, built to the admin prototype. The old AdminOverviewClient component stays in this folder, unused.
import OverviewScreen from '@/components/admin/console/OverviewScreen';
import { requireArea } from '@/lib/admin/access';
import { getOverview } from '@/lib/admin/overview';
import { can } from '@/lib/admin/areas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

export default async function AdminOverviewPage() {
  const staff = await requireArea('overview', 'view');
  const data = await getOverview((area) => can(staff.uiLevel(area), 'view'));
  return <OverviewScreen data={data} />;
}
