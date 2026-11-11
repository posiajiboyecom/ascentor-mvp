import CreditsScreen from '@/components/admin/console/CreditsScreen';
import { requireArea } from '@/lib/admin/access';
import { loadCredits } from '@/lib/admin/billing-admin-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referral credits' };

export default async function CreditsPage() {
  await requireArea('referrals', 'view');
  const { balances, ledger, totalLabel, note } = await loadCredits();
  return <CreditsScreen balances={balances} ledger={ledger} total={totalLabel} note={note} />;
}
