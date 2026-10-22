import SubscriptionsScreen from '@/components/admin/console/SubscriptionsScreen';
import { requireArea } from '@/lib/admin/access';
import { billingV2Enabled } from '@/lib/billing/flags';
import { chargingMode } from '@/lib/billing/engine';
import { loadSubscriptions } from '@/lib/admin/billing-admin-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscriptions' };

export default async function SubscriptionsPage() {
  const staff = await requireArea('payments', 'view');
  const { rows, kpis, note } = await loadSubscriptions();
  const level = staff.uiLevel('payments');
  return <SubscriptionsScreen rows={rows} kpis={kpis} note={note} level={level} v2On={billingV2Enabled()} mode={chargingMode()} />;
}
