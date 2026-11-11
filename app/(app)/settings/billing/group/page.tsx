// Group status page (billing v2): code, link, QR, active count, status in plain words. Active count only, never who failed to pay.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getMe } from '@/lib/rx/server';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { getGroupStatus } from '@/lib/billing/groups';
import { priceFor, groupDiscountApplies } from '@/lib/billing/catalog';
import { visitorCurrency } from '@/lib/geo';
import { billingCurrencyFor } from '@/lib/billing/currency';
import GroupClient from '@/components/billing/GroupClient';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your group' };

export default async function GroupPage() {
  const me = await getMe();
  if (!me) redirect('/login?redirect=/settings/billing/group');
  const status = await getGroupStatus(me.userId);
  // Group prices are naira only. A member billed in US dollars can still be in a group (they count towards their friends' 3),
  // but they pay the same price either way.
  const currency = await billingCurrencyFor(me.userId, await visitorCurrency());
  const qr = status.group ? await QRCode.toDataURL(status.group.link, { margin: 1, width: 400, errorCorrectionLevel: 'M' }).catch(() => null) : null;

  return (
    <Page>
      <BackLink href="/settings/billing">Billing</BackLink>
      <Title>Your group</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {!groupDiscountApplies(currency) && (
            <div className="bl-msg" role="note">Group prices are for members in Nigeria, who pay in naira. You’re billed in US dollars, so your price stays the same in a group. You still count towards your friends’ 3.</div>
          )}
          <GroupClient status={status} qr={qr} tz={me.tz} prices={{ soloKobo: priceFor('explorer', 'solo', 'monthly'), groupKobo: priceFor('explorer', 'group', 'monthly') }} />
        </div>
        <Aside>
          <p className="rx-sl">Good to know</p>
          <p className="rx-p">A group needs 3 active members. Free Leaders do not count toward the 3. Any plan counts, and so does a yearly plan.</p>
          <p className="rx-p">If your group drops below 3, you have 14 days to replace someone before prices move back to solo.</p>
          <Link href="/settings/billing" className="rx-link muted">Back to billing</Link>
        </Aside>
      </div>
    </Page>
  );
}
