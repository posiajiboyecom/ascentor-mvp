import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { acceptLeaderInvite, getInviteByToken, SETUP_MESSAGE } from '@/lib/leader-invites';
import { emailsMatch } from '@/lib/leader-invite-core';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export const metadata = { title: 'Your Leader invite', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

async function accept(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/facilitator/${token}`)}`);
  const r = await acceptLeaderInvite(token, { id: user.id, email: user.email });
  if (r.ok) redirect(`/facilitator/${token}?welcome=1`);
  redirect(`/facilitator/${token}?e=${r.reason}`);
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

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <h1 className="rx-h2" style={{ fontSize: 26 }}>{title}</h1>
      <p className="rx-p">{text}</p>
      <Link href="/contact" className="rx-btn primary block">Contact us</Link>
      <Link href="/" className="rx-btn secondary block">Back to Ascentor</Link>
    </Shell>
  );
}

const DO = [
  'Host the weekly Circle call and keep time.',
  'Check in on members who go quiet.',
  'Help your Circle choose a mentor and prepare session agendas.',
];

export default async function LeaderInviteTokenPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string; welcome?: string }> }) {
  const { token } = await params;
  const { e, welcome } = await searchParams;
  const { invite, setup } = await getInviteByToken(token);
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (setup) return <Problem title="Invites are not available yet" text={SETUP_MESSAGE} />;
  if (!invite) return <Problem title="This invite link is not valid" text="We could not find an invite for this link. Check that you opened the whole link from your email, or contact us and we will help." />;
  if (invite.status === 'used' && welcome === '1' && user && invite.usedBy === user.id) {
    return (
      <Shell>
        <span className="rx-tag gold" style={{ alignSelf: 'flex-start' }}>Leader</span>
        <h1 className="rx-h2" style={{ fontSize: 28 }}>Welcome, you now lead for free while you facilitate a Circle</h1>
        <p className="rx-p">Your invite is accepted. There is nothing to pay and no card to enter.</p>
        <Link href="/dashboard" className="rx-btn primary block">Go to your dashboard</Link>
      </Shell>
    );
  }
  if (invite.status === 'used') return <Problem title="This invite has already been used" text="Each invite link works once. If you already accepted it, you are all set. Otherwise contact us." />;
  if (invite.status === 'revoked') return <Problem title="This invite is no longer active" text="The team has withdrawn this invite. Contact us if you think that is a mistake." />;
  if (invite.status === 'expired') return <Problem title="This invite has expired" text="Invite links last 14 days. Contact us and we will send you a new one." />;

  const mismatch = !!user && !emailsMatch(user.email, invite.email);
  const here = `/facilitator/${token}`;
  const flash = e === 'mismatch' ? 'mismatch' : e === 'unavailable' ? 'This invite can no longer be used.' : e === 'error' ? 'We could not finish that. Please try again.' : '';

  return (
    <Shell>
      <span className="rx-tag gold" style={{ alignSelf: 'flex-start' }}>Leader invite</span>
      <h1 className="rx-h2" style={{ fontSize: 28 }}>{invite.name?.trim() ? `${invite.name.trim().split(/\s+/)[0]}, you are invited to lead` : 'You are invited to lead'}</h1>
      <p className="rx-p">{invite.inviterName} has invited you to be a Leader on Ascentor. A Leader hosts a Circle: a small group that meets every week for 90 days and helps each member keep their promises.</p>
      <div className="rx-card rx-stack-sm">
        <p className="rx-label">What you would do</p>
        {DO.map((t) => (
          <p key={t} className="rx-p rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Check aria-hidden className="rx-gc" style={{ marginTop: 3, width: 18, height: 18 }} />{t}
          </p>
        ))}
      </div>
      <p className="rx-p">Leaders lead for free while they facilitate a Circle. You do not need to enter a card.</p>
      {flash && flash !== 'mismatch' && <p className="rx-p" role="alert">{flash}</p>}
      {(mismatch || flash === 'mismatch') && user ? (
        <>
          <p className="rx-p" role="alert">This invite was sent to a different email address than the one you are signed in with ({user.email}). Sign in with the address the invite was sent to, or contact us.</p>
          <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="rx-btn primary block">Sign in with another account</Link>
          <Link href="/contact" className="rx-btn secondary block">Contact us</Link>
        </>
      ) : user ? (
        <form action={accept}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="rx-btn primary block">Accept and continue</button>
        </form>
      ) : (
        <>
          <p className="rx-p">Use the email address this invite was sent to. If you do not have an account yet, create one with that address, then open this link again.</p>
          <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="rx-btn primary block">Log in to accept</Link>
          <Link href={`/signup?redirect=${encodeURIComponent(here)}`} className="rx-btn secondary block">Create an account</Link>
        </>
      )}
      <Link href="/" className="rx-btn secondary block">Not now</Link>
    </Shell>
  );
}
