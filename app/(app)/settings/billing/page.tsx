// Settings > Billing (billing v2). Only exists while BILLING_V2=on; otherwise it sends the member to today's Plan tab.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { Aside, Page, Title } from '@/components/rx/ui';
import { billingV2Enabled } from '@/lib/billing/flags';
import { loadBillingView } from '@/lib/billing/member-view';
import BillingClient from '@/components/billing/BillingClient';
import SettingsTabs from '@/components/billing/SettingsTabs';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  if (!billingV2Enabled()) redirect('/settings?tab=plan');
  const me = await getMe();
  if (!me) redirect('/login?redirect=/settings/billing');
  const data = await loadBillingView(me.userId);

  return (
    <Page>
      <Title>Settings</Title>
      <SettingsTabs active="plan" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          <BillingClient data={data} tz={me.tz} />
        </div>
        <Aside>
          <p className="rx-sl">Good to know</p>
          <p className="rx-p">Every plan starts with 7 days free. You are charged on day 8, and you can cancel before then to pay nothing.</p>
          <p className="rx-p">Write to contact@joinascentor.com for help with a payment. We reply within 2 to 3 business days.</p>
          <Link href="/settings?tab=account" className="rx-link muted">Back to your account</Link>
        </Aside>
      </div>
    </Page>
  );
}
