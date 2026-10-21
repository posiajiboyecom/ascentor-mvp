import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Globe, Instagram, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe, namesFor } from '@/lib/rx/server';
import { Aside, GoLink, Page, Title } from '@/components/rx/ui';
import { EmailCard, NotificationsCard } from '@/components/rx/settings/SettingsClient';
import DeviceCard from '@/components/rx/settings/DeviceCard';
import AccountTab from '@/components/rx/settings/AccountTab';
import ProfileTab from '@/components/rx/settings/ProfileTab';
import SecurityTab from '@/components/rx/settings/SecurityTab';
import PlanTab, { type HistoryRow } from '@/components/rx/settings/PlanTab';
import { canChooseLeader } from '@/lib/leader-access';
import { deriveBilling } from '@/lib/billing-state';
import { planDisplayName } from '@/lib/plans-display';
import { getFeaturedPricing, planPriceLabel } from '@/lib/plans-config';
import { formatNaira } from '@/lib/pricing';
import '@/styles/rx-settings.css';

export const dynamic = 'force-dynamic';

const TABS = [['account', 'Account'], ['profile', 'Profile'], ['security', 'Security'], ['plan', 'Plan'], ['alerts', 'Alerts']] as const;
type Tab = (typeof TABS)[number][0];

const dateLong = (d: string | Date, tz: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
const dateShort = (d: string | Date, tz: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.find(([k]) => k === rawTab)?.[0]) ?? 'account';

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const p = me.profile;
  const tz = me.tz;

  const { data: prof } = await db
    .from('profiles')
    .select('full_name, what_building, avatar_url, subscription_plan, subscription_status, subscription_end, subscription_start, card_details, payment_method, referral_bonus_days')
    .eq('id', user.id)
    .maybeSingle();

  const providers = [...new Set([...((user.app_metadata?.providers as string[] | undefined) ?? []), user.app_metadata?.provider as string | undefined].filter((x): x is string => Boolean(x)))];
  const methods = providers.length ? providers : ['email'];
  const hasPassword = methods.includes('email');
  const name = prof?.full_name && prof.full_name !== 'New User' ? (prof.full_name as string) : (user.email?.split('@')[0] || 'Member');
  const email = user.email ?? '';

  let body: React.ReactNode = null;

  if (tab === 'account') {
    body = (
      <AccountTab name={name} email={email} memberSince={dateLong(user.created_at, tz)} methods={methods} hasPassword={hasPassword}
        language={p?.language ?? 'English'} timezoneLabel={p?.timezone_label ?? p?.timezone ?? ''} />
    );
  } else if (tab === 'profile') {
    const { data: cityRows } = await db.from('rx_groups').select('name').eq('is_city', true).eq('status', 'active');
    body = (
      <ProfileTab userId={user.id} name={name} headline={(prof?.what_building as string | null) ?? ''} city={p?.city ?? ''}
        cities={((cityRows ?? []) as { name: string }[]).map((c) => c.name)} stage={p?.stage ?? ''} interests={p?.interests ?? []}
        avatarUrl={(prof?.avatar_url as string | null) ?? null} />
    );
  } else if (tab === 'security') {
    const { data: blockRows } = await db.from('dm_blocks').select('blocked_id').eq('blocker_id', me.userId);
    const blockedIds = ((blockRows ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
    const blockedNames = blockedIds.length ? await namesFor(db, blockedIds) : new Map();
    const blocked = blockedIds.map((id) => ({ id, name: (blockedNames.get(id) as { name: string } | undefined)?.name ?? 'Member' }));
    body = <SecurityTab email={email} methods={methods} hasPassword={hasPassword} dmPolicy={p?.dm_policy ?? 'circle_and_requests'} research={p?.research_opt_in ?? false} blocked={blocked} />;
  } else if (tab === 'plan') {
    // Own rows only, read on the server with the member's id from the session.
    const { data: pays } = await supabaseAdmin
      .from('payments')
      .select('id, plan_id, billing, amount, status, paid_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(24);
    const payRows = (pays ?? []) as { id: string; plan_id: string | null; billing: string | null; amount: number | null; paid_at: string | null; created_at: string }[];
    const lastPaid = payRows[0];
    const featured = getFeaturedPricing();
    // What the member really pays (their last payment) wins over today's list price, so a price change never rewrites it.
    const bill = deriveBilling(prof, tz, new Date(), planPriceLabel(prof?.subscription_plan as string | null, lastPaid?.billing, lastPaid?.amount));
    const planNow = bill.plan as string;
    const listed = planNow === 'explorer' ? featured.explorer : planNow === 'builder' ? featured.builder : planNow === 'leader' ? featured.leader : null;
    const paidOnList = !!lastPaid?.amount && !!listed && (lastPaid.amount === listed.monthlyPrice || lastPaid.amount === listed.yearlyPrice);
    // Legacy: Climber, or a plan held at an older price. They keep their plan and price; shown as a labelled card.
    const legacy = bill.state !== 'none' && (planNow === 'climber' || (!!listed && !!lastPaid?.amount && !paidOnList))
      ? { name: bill.planName, line: planPriceLabel(prof?.subscription_plan as string | null, lastPaid?.billing, lastPaid?.amount) }
      : null;
    const history: HistoryRow[] = payRows.map((x) => ({
      id: x.id,
      date: dateShort(x.paid_at ?? x.created_at, tz),
      desc: `${planDisplayName(x.plan_id)} · ${x.billing === 'annual' || x.billing === 'yearly' ? 'yearly' : 'monthly'}`,
      amount: x.amount ? formatNaira(Number(x.amount)) : '',
      status: 'Paid',
      receipt: true,
    }));
    if (prof?.subscription_status === 'trialing' && prof.subscription_start) {
      history.push({ id: 'first-period', date: dateShort(prof.subscription_start as string, tz), desc: 'First period started · includes 7 extra days', amount: '', status: '-', receipt: false });
    }
    const card = prof?.card_details as { last4?: string } | null;
    const cardLine = card?.last4 ? `Card ending ${card.last4} · via Paystack` : prof?.payment_method ? 'Card on file · via Paystack' : null;
    body = (
      <PlanTab state={bill.state} plan={bill.plan} planName={bill.planName} tag={bill.tag} line={bill.line} daysLeft={bill.daysLeft}
        untilShort={bill.untilShort} cardLine={cardLine} referralDays={(prof?.referral_bonus_days as number | null) ?? 0} history={history}
        prices={{ explorer: { monthly: featured.explorer.monthlyPrice, yearly: featured.explorer.yearlyPrice }, builder: { monthly: featured.builder.monthlyPrice, yearly: featured.builder.yearlyPrice }, leader: { monthly: featured.leader.monthlyPrice, yearly: featured.leader.yearlyPrice } }}
        legacy={legacy} showLeader={await canChooseLeader(user.id)} />
    );
  } else {
    const zone = new Intl.DateTimeFormat('en-NG', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value ?? 'your time zone';
    body = (
      <>
        <NotificationsCard notif={p?.notif ?? {}} annMuted={p?.ann_muted ?? false} quiet={p?.quiet_hours ?? true} zone={zone} />
        <DeviceCard />
        <EmailCard />
        <div className="rx-card st"><p className="rx-sl">Sage reminders</p><p className="rx-p">How often Sage nudges you, and when.</p><div><GoLink href="/sage/reminders">Reminder settings</GoLink></div></div>
      </>
    );
  }

  return (
    <Page>
      <Title>Settings</Title>
      <div className="rx-opts rx-tabs" role="tablist" aria-label="Settings">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/settings?tab=${k}`} scroll={false} replace role="tab" aria-selected={tab === k} className={`rx-opt${tab === k ? ' on' : ''}`}>{label}</Link>
        ))}
      </div>
      <div className="rx-two">
        <div className="rx-stack-lg">{body}</div>
        <Aside>
          <p className="rx-sl">Sage</p>
          <GoLink href="/sage/memory">What Sage knows</GoLink>
          <GoLink href="/sage/reminders">Reminder settings</GoLink>
          <p className="rx-sl">Help</p>
          <p className="rx-p">Write to contact@joinascentor.com. We reply within 2 to 3 business days.</p>
          <div className="rx-row" style={{ gap: 16 }}>
            <Link href="/terms" className="rx-link" style={{ fontSize: 14 }}>Terms</Link>
            <Link href="/privacy" className="rx-link" style={{ fontSize: 14 }}>Privacy policy</Link>
          </div>
          <p className="rx-sl">Ascentor</p>
          <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><Globe aria-hidden style={{ width: 16, height: 16 }} />www.joinascentor.com</p>
          <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><Instagram aria-hidden style={{ width: 16, height: 16 }} />Instagram: theelevationsummit</p>
          <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><X aria-hidden style={{ width: 16, height: 16 }} />X: elevatnsummit</p>
        </Aside>
      </div>
    </Page>
  );
}
