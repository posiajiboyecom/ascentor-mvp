// Settings > Billing: plans (Seeker and Builder), cards, groups, credit and billing history.
import { SUPPORT_EMAIL } from '@/lib/contact';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { Aside, Page, Title } from '@/components/rx/ui';
import { isCheckoutOn } from '@/lib/checkout-switch';
import { loadBillingView } from '@/lib/billing/member-view';
import BillingClient from '@/components/billing/BillingClient';
import SettingsTabs from '@/components/billing/SettingsTabs';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const me = await getMe();
  if (!me) redirect('/login?redirect=/settings/billing');
  const [data, checkoutOn] = await Promise.all([loadBillingView(me.userId), isCheckoutOn()]);

  return (
    <Page>
      <Title>Settings</Title>
      <SettingsTabs active="plan" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          <BillingClient data={data} tz={me.tz} checkoutOn={checkoutOn} />
        </div>
        <Aside>
          <p className="rx-sl">Good to know</p>
          <p className="rx-p">Every plan starts with 7 days free. You are charged on day 8, and you can cancel before then to pay nothing.</p>
          <p className="rx-p">Write to {SUPPORT_EMAIL} for help with a payment. We reply within 2 to 3 business days.</p>
          <Link href="/settings?tab=account" className="rx-link muted">Back to your account</Link>
        </Aside>
      </div>
    </Page>
  );
}
