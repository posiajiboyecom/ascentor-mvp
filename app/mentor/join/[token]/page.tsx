// /mentor/join/<token>: a personal mentor link made by an admin (Admin > Mentors > Invite a mentor). The person joins straight
// as a mentor: no member sign-up, onboarding, plan or Circle. One form, then they land on the Mentor view to add free times.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AuthShell } from '@/components/auth/AuthShell';
import { getMentorInviteByToken, MENTOR_SETUP_MESSAGE } from '@/lib/mentor-invites';
import { emailsMatch } from '@/lib/mentor-invite-core';
import MentorJoinForm from './MentorJoinForm';

export const metadata = { title: 'Join Ascentor as a mentor', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <AuthShell title="Mentor invite" sub="A personal link from the Ascentor team.">
      <div className="ax-st">
        <h1 className="ax-h2">{title}</h1>
        <p className="ax-p">{text}</p>
        <a href="mailto:joinascentor@gmail.com" className="ax-btn bp bw">Email the Ascentor team</a>
        <Link href="/" className="ax-btn bs bw">Back to Ascentor</Link>
      </div>
    </AuthShell>
  );
}

export default async function MentorJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { invite, setup } = await getMentorInviteByToken(token);
  if (setup) return <Problem title="Mentor links are not available yet" text={MENTOR_SETUP_MESSAGE} />;
  if (!invite) return <Problem title="This link is not valid" text="Check that you opened the whole link, or ask the Ascentor team for a new one." />;
  if (invite.status === 'used') return <Problem title="This link has already been used" text="Each mentor link works once. If you joined with it, log in to see your Mentor view." />;
  if (invite.status === 'revoked') return <Problem title="This link is no longer active" text="The Ascentor team cancelled it. Get in touch if you think that is a mistake." />;
  if (invite.status === 'expired') return <Problem title="This link has expired" text="Mentor links last 7 days. Ask the Ascentor team and they will send you a fresh one." />;

  const { data: { user } } = await (await createClient()).auth.getUser();
  const first = invite.name?.trim().split(/\s+/)[0];
  const here = `/mentor/join/${token}`;
  const intro = (
    <>
      <p className="ax-sm" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Founding mentor</p>
      <h1 className="ax-h2">{first ? `${first}, join Ascentor as a mentor` : 'Join Ascentor as a mentor'}</h1>
      <p className="ax-p muted">{invite.inviterName} invited you. You would mentor a small Circle on a 20-minute call every two weeks, about 40 minutes a month. Their questions reach you 48 hours before each call. It is free, with no card and no member sign-up.</p>
    </>
  );

  // Signed in with another address: this link is not theirs to use.
  if (user && !emailsMatch(user.email, invite.email)) {
    return (
      <AuthShell title="Mentor invite" sub="A personal link from the Ascentor team.">
        <div className="ax-st">
          {intro}
          <p className="ax-banner err" role="alert">You are signed in as {user.email}, but this link was made for {invite.email}. Log in with that address, or ask the Ascentor team for a link to your email.</p>
          <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="ax-btn bp bw">Log in with {invite.email}</Link>
        </div>
      </AuthShell>
    );
  }

  // Has an account with this email but is not signed in: log in first, then come back here.
  if (!user && invite.hasAccount) {
    return (
      <AuthShell title="Welcome back." sub="Log in to finish joining as a mentor.">
        <div className="ax-st">
          {intro}
          <p className="ax-p">You already have an Ascentor account with <b>{invite.email}</b>. Log in, and you will come straight back here to finish.</p>
          <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="ax-btn bp bw">Log in to continue</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Raise the next generation." sub="About two minutes to join.">
      <div className="ax-st">
        {intro}
        <MentorJoinForm token={token} email={invite.email} name={invite.name ?? ''} mode={user ? 'existing' : 'new'} />
      </div>
    </AuthShell>
  );
}
