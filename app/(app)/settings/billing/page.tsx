// Settings > Billing: plan (Seeker, Builder or Pinnacle) and changing it, cards, groups, credit and billing history.
import { SUPPORT_EMAIL } from '@/lib/contact';
import { redirect } from 'next/navigation';
import { visitorCurrency } from '@/lib/geo';
import { getMe } from '@/lib/rx/server';
import { Aside, Page, Title } from '@/components/rx/ui';
import { isCheckoutOn } from '@/lib/checkout-switch';
import { loadBillingView } from '@/lib/billing/member-view';
import BillingClient from '@/components/billing/BillingClient';
import SettingsTabs from '@/components/billing/SettingsTabs';
import PlanChanger from '@/components/billing/PlanChanger';
import { closedPlanIds } from '@/lib/admin/plans-open';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const me = await getMe();
  if (!me) redirect('/login?redirect=/settings/billing');
  const [data, checkoutOn, closed] = await Promise.all([loadBillingView(me.userId, await visitorCurrency()), isCheckoutOn(), closedPlanIds()]);
  const sub = data.sub;
  // A plan can be changed while it is running: in the trial, active or in grace, and not set to end.
  const canChange = !!sub && (sub.state === 'trial' || sub.state === 'active' || sub.state === 'grace') && !sub.cancelAtPeriodEnd;

  return (
    <Page>
      <Title>Settings</Title>
      <SettingsTabs active="billing" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          <BillingClient data={data} tz={me.tz} checkoutOn={checkoutOn} />
          {canChange && sub && <PlanChanger tier={sub.tier} cycle={sub.cycle} trial={sub.state === 'trial'} nextChargeAt={sub.nextChargeAt} scheduled={sub.scheduled} currency={data.currency} closed={closed} tz={me.tz} />}
        </div>
        <Aside>
          <p className="rx-sl">Good to know</p>
          <p className="rx-p">You can change between Seeker, Builder and Pinnacle at any time. On a paid plan the change starts at your next billing date.</p>
          <p className="rx-p">Every plan starts with 7 days free. You are charged on day 8, and you can cancel before then to pay nothing.</p>
          <p className="rx-p">Write to {SUPPORT_EMAIL} for help with a payment. We reply within 2 to 3 business days.</p>
        </Aside>
      </div>
    </Page>
  );
}
