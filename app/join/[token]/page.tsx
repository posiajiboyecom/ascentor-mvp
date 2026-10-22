// /join/<token>: the group link a member shares (for example on WhatsApp). Public page. It explains the group price, then sends the
// visitor to log in or sign up, and on to checkout with the group already chosen. Shows no member names or payment details.
// Only exists while BILLING_V2=on.
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { billingV2Enabled } from '@/lib/billing/flags';
import { deviceHintFrom, getGroupStatus, joinByToken, previewGroup } from '@/lib/billing/groups';
import { formatNaira, priceFor } from '@/lib/billing/catalog';
import { GROUP_MIN } from '@/lib/billing/rules';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';
import '@/styles/rx-billing.css';

export const metadata = { title: 'Join a group', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

async function join(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const here = `/join/${token}`;
  if (!billingV2Enabled()) redirect('/');
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(here)}`);
  const r = await joinByToken(user.id, token, { device: deviceHintFrom(await headers()) });
  if (!r.ok) redirect(`${here}?e=${encodeURIComponent(r.reason)}`);
  const { data: sub } = await supabaseAdmin.from('member_subscriptions').select('user_id').eq('user_id', user.id).maybeSingle();
  redirect(sub ? '/settings/billing/group' : `/checkout?group=${encodeURIComponent(r.group.code)}`);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rx rx-entry">
      <div className="rx-entry-in rx-rise">
        <Link href="/" className="rx-entry-logo"><img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" /></Link>
        {children}
      </div>
    </div>
  );
}

const REASON_TEXT: Record<string, string> = {
  in_group: 'You are already in a group. Leave it first, then you can join another.',
  expired: 'This group link has expired. Ask your friend for a new one.',
  full: 'This group is full. A group can have up to 10 members.',
  code_used_up: 'This group link has been used the most times it can be. Ask your friend to start a new group.',
  not_found: 'We could not find this group.',
  error: 'We could not add you to the group. Please try again.',
};

export default async function JoinGroupPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  if (!billingV2Enabled()) notFound();
  const { token } = await params;
  const { e } = await searchParams;
  const here = `/join/${token}`;
  const preview = await previewGroup({ token });

  if (!preview.found) {
    return (
      <Shell>
        <h1 className="rx-h2" style={{ fontSize: 26 }}>This group link is not valid</h1>
        <p className="rx-p">We could not find a group for this link. Check that you opened the whole link your friend sent you.</p>
        <Link href="/" className="rx-btn secondary block">Back to Ascentor</Link>
      </Shell>
    );
  }

  const { data: { user } } = await (await createClient()).auth.getUser();
  let error = e ? REASON_TEXT[e] ?? '' : '';
  if (e === 'switch_locked' && user) {
    const st = await getGroupStatus(user.id);
    error = st.canSwitchAt
      ? `You joined a group recently. You can switch groups once every 90 days, so you can join another from ${new Date(st.canSwitchAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })}.`
      : 'You joined a group recently. You can switch groups once every 90 days.';
  }
  if (!error && !preview.joinable && preview.message) error = preview.message;

  const seekerSolo = formatNaira(priceFor('explorer', 'solo', 'monthly'));
  const seekerGroup = formatNaira(priceFor('explorer', 'group', 'monthly'));
  const builderSolo = formatNaira(priceFor('builder', 'solo', 'monthly'));
  const builderGroup = formatNaira(priceFor('builder', 'group', 'monthly'));

  return (
    <Shell>
      <span className="rx-tag gold" style={{ alignSelf: 'flex-start' }}>Group invite</span>
      <h1 className="rx-h2" style={{ fontSize: 28 }}>A friend invited you to join their group</h1>
      <p className="rx-p">When {GROUP_MIN} or more of you are active members together, each person pays less. Everyone pays for themselves, and nobody pays for anyone else.</p>
      <div className="rx-card rx-stack-sm">
        <p className="rx-label">What it costs each month</p>
        <p className="rx-p rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}><Check aria-hidden className="rx-gc" style={{ marginTop: 3, width: 18, height: 18 }} />Seeker: {seekerGroup} once {GROUP_MIN} friends join, {seekerSolo} until then.</p>
        <p className="rx-p rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}><Check aria-hidden className="rx-gc" style={{ marginTop: 3, width: 18, height: 18 }} />Builder: {builderGroup} once {GROUP_MIN} friends join, {builderSolo} until then.</p>
        <p className="rx-p rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}><Check aria-hidden className="rx-gc" style={{ marginTop: 3, width: 18, height: 18 }} />Every plan starts with 7 days free. You are charged on day 8, and you can cancel before then to pay nothing.</p>
      </div>
      {error && <p className="rx-p" role="alert">{error}</p>}
      {user ? (
        preview.joinable ? (
          <form action={join}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="rx-btn primary block">Join this group and continue</button>
          </form>
        ) : (
          <Link href="/settings/billing/group" className="rx-btn primary block">See your group</Link>
        )
      ) : (
        <>
          <Link href={`/signup?redirect=${encodeURIComponent(here)}`} className="rx-btn primary block">Create an account to join</Link>
          <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="rx-btn secondary block">I already have an account</Link>
        </>
      )}
      <Link href="/" className="rx-btn secondary block">Not now</Link>
    </Shell>
  );
}
