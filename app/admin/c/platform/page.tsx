// Platform settings, built to the admin prototype. The level is checked here to draw and again in the server action to save.
import PlatformSettings from '@/components/admin/console/PlatformSettings';
import { requireArea } from '@/lib/admin/access';
import { getSettings } from '@/lib/admin/settings';
import { can } from '@/lib/admin/areas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform settings' };

// Connected means the server has what it needs to talk to the service. Values are never read out.
const set = (...names: string[]) => names.every((n) => !!process.env[n]);
const INTEGRATIONS: [string, string, boolean][] = [
  ['Supabase', 'Database, sign-in and realtime chat', set('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')],
  ['Paystack', 'Subscriptions, shop and Summit payments', set('PAYSTACK_SECRET_KEY')],
  ['Daily', 'Circle and mentor calls', set('DAILY_API_KEY')],
  ['Anthropic', 'Sage · AI coach', set('ANTHROPIC_API_KEY')],
  ['Cohere', 'Sage knowledge search', set('COHERE_API_KEY')],
  ['Trigger.dev', 'Background jobs and reminders', set('TRIGGER_SECRET_KEY')],
  ['Vercel', 'Hosting', set('VERCEL')],
];

export default async function PlatformPage() {
  const staff = await requireArea('platform', 'view');
  const values = await getSettings();
  return (
    <PlatformSettings
      values={values}
      canEdit={can(staff.uiLevel('platform'), 'edit') && can(staff.level('platform'), 'edit')}
      integrations={INTEGRATIONS.map(([name, use, connected]) => ({ name, use, connected }))}
    />
  );
}
