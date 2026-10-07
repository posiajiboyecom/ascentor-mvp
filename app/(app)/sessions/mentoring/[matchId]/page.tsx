import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor } from '@/lib/rx/server';
import { agreementFor, mentorMessages, myMentorProfile } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, BackLink, Page, Tag, Title } from '@/components/rx/ui';
import { Workspace } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function MentorMenteePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const mentor = await myMentorProfile();
  if (!mentor) redirect('/sessions');
  const db = await createClient();
  const { data: m } = await db.from('mentor_matches').select('id, member_id, mentor_id, status, slot_at').eq('id', matchId).eq('mentor_id', mentor.id).maybeSingle();
  if (!m || m.status !== 'active') notFound();
  const [agreement, msgs, names, { data: card }, { data: goal }] = await Promise.all([
    agreementFor(db, matchId), mentorMessages(db, matchId), namesFor(db, [m.member_id as string]),
    db.from('rx_member_cards').select('stage, city, interests').eq('user_id', m.member_id).maybeSingle(),
    db.from('user_goals').select('goal_text').eq('user_id', m.member_id).order('position').limit(1).maybeSingle(),
  ]);
  const name = names.get(m.member_id as string)?.name ?? 'Member';
  const first = name.split(' ')[0];
  const c = card as { stage: string | null; city: string | null; interests: string[] | null } | null;

  return (
    <Page>
      <BackLink href="/sessions/mentoring">Mentoring</BackLink>
      <Title>{name}</Title>
      <div className="rx-two">
        <Workspace matchId={matchId} role="mentor" agreement={agreement} meId={me.userId} initialMessages={msgs} otherName={first} />
        <Aside>
          <p className="rx-label">About {first}</p>
          <div className="rx-row" style={{ gap: 6 }}>{c?.stage && <Tag>{c.stage}</Tag>}{c?.city && <Tag>{c.city}</Tag>}</div>
          {goal?.goal_text && <><p className="rx-label">Their goal</p><p className="rx-p">{goal.goal_text as string}</p></>}
          {c?.interests?.length ? <><p className="rx-label">Interests</p><div className="rx-row" style={{ gap: 6 }}>{c.interests.map((t) => <Tag key={t}>{t}</Tag>)}</div></> : null}
          {m.slot_at && <><p className="rx-label">Next session</p><p className="rx-p">{whenLabel(m.slot_at as string, me.tz)}</p></>}
        </Aside>
      </div>
    </Page>
  );
}
