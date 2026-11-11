// Group status page (billing v2): code, link, QR, active count, status in plain words. Active count only, never who failed to pay.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getMe } from '@/lib/rx/server';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { getGroupStatus } from '@/lib/billing/groups';
import { priceFor } from '@/lib/billing/catalog';
import GroupClient from '@/components/billing/GroupClient';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your group' };

export default async function GroupPage() {
  const me = await getMe();
  if (!me) redirect('/login?redirect=/settings/billing/group');
  const status = await getGroupStatus(me.userId);
  const qr = status.group ? await QRCode.toDataURL(status.group.link, { margin: 1, width: 400, errorCorrectionLevel: 'M' }).catch(() => null) : null;

  return (
    <Page>
      <BackLink href="/settings/billing">Billing</BackLink>
      <Title>Your group</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
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
