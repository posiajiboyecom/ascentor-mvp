import EmailRegistrants from '@/components/admin/console/EmailRegistrants';
import { requireArea } from '@/lib/admin/access';

export const dynamic = 'force-dynamic';
// Each press sends a few emails, spaced out, and runs under this limit.
export const maxDuration = 60;
export const metadata = { title: 'Email registrants' };

export default async function Page() {
  const staff = await requireArea('registrations', 'view');
  const level = staff.uiLevel('registrations');
  return <EmailRegistrants canSend={level === 'edit' || level === 'full'} />;
}
