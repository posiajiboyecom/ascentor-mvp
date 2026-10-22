import CreditsScreen from '@/components/admin/console/CreditsScreen';
import { requireArea } from '@/lib/admin/access';
import { loadCredits } from '@/lib/admin/billing-admin-data';
import { koboToNaira } from '@/lib/admin/billing-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referral credits' };

export default async function CreditsPage() {
  await requireArea('referrals', 'view');
  const { balances, ledger, totalKobo, note } = await loadCredits();
  return <CreditsScreen balances={balances} ledger={ledger} total={koboToNaira(totalKobo)} note={note} />;
}
