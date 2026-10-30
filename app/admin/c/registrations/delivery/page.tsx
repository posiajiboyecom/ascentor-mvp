import DeliveryScreen from '@/components/admin/console/DeliveryScreen';
import { requireArea } from '@/lib/admin/access';
import { loadDelivery } from '@/lib/summitDelivery';

export const dynamic = 'force-dynamic';
// A server action sends a small batch (about 4 tickets, spaced out) and runs under this limit.
export const maxDuration = 60;
export const metadata = { title: 'Summit delivery' };

export default async function DeliveryPage() {
  const staff = await requireArea('registrations', 'view');
  let data: Awaited<ReturnType<typeof loadDelivery>> = { rows: [], unconfirmed: 0 };
  let loadError = '';
  try { data = await loadDelivery(); } catch (e) { console.error('[admin/registrations/delivery] load failed:', e); loadError = 'We could not load the delivery list. Try again in a moment.'; }
  const level = staff.uiLevel('registrations');
  return <DeliveryScreen rows={data.rows} unconfirmed={data.unconfirmed} canSend={level === 'edit' || level === 'full'} canExport={level === 'full'} loadError={loadError} />;
}
