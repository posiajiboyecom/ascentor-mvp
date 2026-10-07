// Mentor-side view: requests to accept, capacity, open times and current mentees.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor } from '@/lib/rx/server';
import { myMentorProfile } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, BackLink, GoLink, Page, Title } from '@/components/rx/ui';
import { CapacityStepper, RequestActions, SlotManager } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function MentoringPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const mentor = await myMentorProfile();
  if (!mentor) redirect('/sessions');
  const db = await createClient();

  const [{ data: matches }, { data: slots }] = await Promise.all([
    db.from('mentor_matches').select('id, member_id, status, first_ask, slot_at, why').eq('mentor_id', mentor.id).in('status', ['requested', 'active']).order('created_at', { ascending: false }),
    db.from('mentor_slots').select('id, starts_at, taken').eq('mentor_id', mentor.id).gt('starts_at', new Date().toISOString()).order('starts_at'),
  ]);
  const rows = (matches ?? []) as { id: string; member_id: string; status: string; first_ask: string | null; slot_at: string | null; why: string | null }[];
  const names = await namesFor(db, rows.map((r) => r.member_id));
  const ids = rows.map((r) => r.member_id);
  const { data: cards } = ids.length ? await db.from('rx_member_cards').select('user_id, stage, city').in('user_id', ids) : { data: [] };
  const card = new Map(((cards ?? []) as { user_id: string; stage: string | null; city: string | null }[]).map((c) => [c.user_id, c]));
  const requests = rows.filter((r) => r.status === 'requested');
  const mentees = rows.filter((r) => r.status === 'active');

  // Agreement progress for each mentee.
  const progress = new Map<string, { goals: number; done: number; tasks: number; confirmed: boolean }>();
  for (const r of mentees) {
    const [g, t, c] = await Promise.all([
      db.from('mentor_goals').select('id', { count: 'exact', head: true }).eq('match_id', r.id),
      db.from('mentor_tasks').select('done').eq('match_id', r.id),
      db.from('mentor_confirmations').select('party').eq('match_id', r.id),
    ]);
    const ts = (t.data ?? []) as { done: boolean }[];
    progress.set(r.id, { goals: g.count ?? 0, done: ts.filter((x) => x.done).length, tasks: ts.length, confirmed: ((c.data ?? []) as unknown[]).length >= 2 });
  }

  return (
    <Page>
      <BackLink href="/sessions">Sessions</BackLink>
      <p className="rx-sm" style={{ marginTop: 8 }}>Mentor view · {mentor.name}</p>
      <Title>Mentoring</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack">
            <p className="rx-label">Requests</p>
            {requests.length === 0 && <p className="rx-sm">No requests waiting.</p>}
            {requests.map((r) => (
              <div key={r.id} className="rx-stack-sm" style={{ paddingBottom: 14, borderBottom: '1px solid var(--rx-border)' }}>
                <div className="rx-row rx-nw" style={{ gap: 10 }}><Avatar name={names.get(r.member_id)?.name} url={names.get(r.member_id)?.avatarUrl} seed={r.member_id} />
                  <div><p className="rx-p rx-strong">{names.get(r.member_id)?.name ?? 'Member'}</p><p className="rx-sm">{[card.get(r.member_id)?.stage, card.get(r.member_id)?.city].filter(Boolean).join(' · ') || 'Member'} · taster{r.slot_at ? ` · ${whenLabel(r.slot_at, me.tz)}` : ''}</p></div></div>
                {r.first_ask && <p className="rx-sm">Wants: {r.first_ask}</p>}
                <div className="rx-row"><RequestActions matchId={r.id} /></div>
              </div>
            ))}
          </div>
          <div className="rx-card rx-stack">
            <p className="rx-label">Mentees</p>
            {mentees.length === 0 && <p className="rx-sm">No active mentees yet.</p>}
            {mentees.map((r) => { const p = progress.get(r.id); return (
              <Link key={r.id} href={`/sessions/mentoring/${r.id}`} className="rx-rowlink">
                <Avatar name={names.get(r.member_id)?.name} url={names.get(r.member_id)?.avatarUrl} seed={r.member_id} />
                <span className="rt"><span className="t">{names.get(r.member_id)?.name ?? 'Member'}</span><span className="m">{p?.goals ?? 0} goals · {p?.done ?? 0} of {p?.tasks ?? 0} tasks · {p?.confirmed ? 'both confirmed' : 'waiting for confirmation'}</span></span>
              </Link>
            ); })}
          </div>
        </div>
        <Aside>
          <p className="rx-label">Capacity</p>
          <CapacityStepper value={mentor.capacity} />
          <p className="rx-sm">{mentees.length} active {mentees.length === 1 ? 'mentee' : 'mentees'}. Requests pause when you’re full.</p>
          <p className="rx-label">Open times</p>
          <SlotManager slots={((slots ?? []) as { id: string; starts_at: string; taken: boolean }[]).map((s) => ({ id: s.id, label: whenLabel(s.starts_at, me.tz), taken: s.taken }))} />
          <GoLink href="/sessions">Back to my own sessions</GoLink>
        </Aside>
      </div>
    </Page>
  );
}
