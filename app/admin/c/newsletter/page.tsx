// Admin → Email: the whole email system (campaigns, contacts from every source, templates, sending settings).
// Takes precedence over the generic /admin/c/[area] list. The level is checked here to draw and again in every action.
import EmailConsole from '@/components/admin/email/EmailConsole';
import { requireArea } from '@/lib/admin/access';
import { can } from '@/lib/admin/areas';
import { loadOverview } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email' };
// "Send next batch" runs inside a request for up to about 40 seconds.
export const maxDuration = 60;

export default async function EmailPage() {
  const staff = await requireArea('newsletter', 'view');
  const r = await loadOverview();
  const lv = (need: 'edit' | 'full') => can(staff.uiLevel('newsletter'), need) && can(staff.level('newsletter'), need);
  return (
    <EmailConsole
      initial={r.ok ? r.overview : null}
      loadError={r.ok ? undefined : r.error}
      canEdit={lv('edit')}
      canSend={lv('full')}
      me={{ email: staff.email ?? '', name: staff.name }}
      triggerReady={!!process.env.TRIGGER_SECRET_KEY}
    />
  );
}
