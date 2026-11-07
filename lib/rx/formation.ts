import 'server-only';
// lib/rx/formation.ts
// Two hourly jobs (run from /api/cron/hourly, which Trigger.dev calls every hour; the daily cron runs them too):
//
// formCircles()        Circles start at 4 members. A home Circle still forming 48 hours after it was created is merged into
//                      the best matching Circle with room, or started as it is with 3+ members (rx_form_circles in the
//                      20261110 migration). Members are told; Circles that can't be settled are reported to admins once a day.
//
// sendMentorAgendas()  The agenda (members' questions) reaches the mentor 48 hours before each session. 72 hours before, a
//                      Circle whose agenda isn't ready is reminded. At 48 hours: ready → sent to the mentor (email and in-app);
//                      not ready → that session is skipped and everyone is told when the next one is.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmailSafe } from '@/lib/nodemailer';
import { asBool, asInt, getSetting } from '@/lib/admin/settings';
import { buildNoticeEmail, circleAudience, rxNotify } from './notifications';
import { circleTitle } from './circles';
import { AGENDA_LEAD_HOURS } from './cmentor';

const HOUR = 3600000;

// ── formation ───────────────────────────────────────────────────────────────

interface FormResult { merged: { from: string; to: string; users: string[] }[]; started: string[]; waiting: string[] }

export async function formCircles(opts: { reportWaiting?: boolean } = {}): Promise<{ merged: number; started: number; waiting: number }> {
  const { data, error } = await supabaseAdmin.rpc('rx_form_circles', { p_hours: 48 });
  if (error) throw new Error(`rx_form_circles: ${error.message}`);
  const r = (data ?? { merged: [], started: [], waiting: [] }) as FormResult;

  const ids = [...new Set([...r.merged.map((m) => m.to), ...r.started, ...r.waiting])];
  const { data: rows } = ids.length ? await supabaseAdmin.from('circles').select('id, name, number, interest').in('id', ids) : { data: [] };
  const byId = new Map(((rows ?? []) as { id: string; name: string; number: number; interest: string | null }[]).map((c) => [c.id, c]));
  const title = (id: string) => { const c = byId.get(id); return c ? circleTitle(c) : 'your Circle'; };

  for (const m of r.merged) {
    await rxNotify(m.users, {
      kind: 'circle_moved', entityId: m.to, url: `/circle?c=${m.to}`,
      title: `You’re now in ${title(m.to)}`,
      body: 'Your first Circle hadn’t filled up after 48 hours, so you’ve joined a Circle that’s ready to go. Say hello in the chat.',
    });
    const others = (await circleAudience(m.to)).filter((id) => !m.users.includes(id));
    await rxNotify(others, { kind: 'circle_new_member', entityId: m.to, url: `/circle?c=${m.to}`, title: 'New members joined your Circle', body: `${m.users.length} new ${m.users.length === 1 ? 'member has' : 'members have'} joined. Welcome them in the chat.` });
  }
  for (const id of r.started) {
    await rxNotify(await circleAudience(id), {
      kind: 'circle_started', entityId: id, url: `/circle?c=${id}`,
      title: `${title(id)} has started`,
      body: 'Your 90-day cycle begins today. Weekly calls are open, and you can choose a mentor together.',
    });
  }
  if (opts.reportWaiting && r.waiting.length) {
    const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
    const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);
    await rxNotify(adminIds, {
      kind: 'circle_new_member', entityId: r.waiting[0], url: '/admin/c/circles',
      title: `${r.waiting.length} ${r.waiting.length === 1 ? 'Circle has' : 'Circles have'} been forming for over 48 hours`,
      body: 'They have fewer than 3 members and no matching Circle with room (usually a different language). New members still fill them first; you can move members or invite more.',
      lines: r.waiting.map(title),
    });
  }
  return { merged: r.merged.length, started: r.started.length, waiting: r.waiting.length };
}

// ── mentor agendas ──────────────────────────────────────────────────────────

interface SessionRow { id: string; circle_id: string; circle_mentor_id: string; mentor_id: string; starts_at: string; agenda_reminded_at: string | null }

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos', timeZoneName: 'short' });

export async function sendMentorAgendas(now: Date = new Date()): Promise<{ reminded: number; sent: number; skipped: number }> {
  const min = asInt(await getSetting('mentor.agenda_questions'), 3, 1, 50);
  const required = asBool(await getSetting('mentor.needs_agenda'));
  let reminded = 0; let sent = 0; let skipped = 0;

  const { data } = await supabaseAdmin.from('circle_mentor_sessions')
    .select('id, circle_id, circle_mentor_id, mentor_id, starts_at, agenda_reminded_at')
    .eq('status', 'scheduled').is('agenda_sent_at', null)
    .gt('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 72 * HOUR).toISOString())
    .order('starts_at');
  const sessions = (data ?? []) as SessionRow[];
  if (!sessions.length) return { reminded, sent, skipped };

  const circleIds = [...new Set(sessions.map((s) => s.circle_id))];
  const mentorIds = [...new Set(sessions.map((s) => s.mentor_id))];
  const [{ data: circles }, { data: mentors }] = await Promise.all([
    supabaseAdmin.from('circles').select('id, name, number, interest, is_demo').in('id', circleIds),
    supabaseAdmin.from('human_mentors').select('id, user_id, name').in('id', mentorIds),
  ]);
  const circleOf = new Map(((circles ?? []) as { id: string; name: string; number: number; interest: string | null; is_demo: boolean }[]).map((c) => [c.id, c]));
  const mentorOf = new Map(((mentors ?? []) as { id: string; user_id: string | null; name: string }[]).map((m) => [m.id, m]));

  for (const s of sessions) {
    const c = circleOf.get(s.circle_id);
    if (!c || c.is_demo) continue;
    const ctitle = circleTitle(c);
    const mentor = mentorOf.get(s.mentor_id);
    const { data: qs } = await supabaseAdmin.from('mentor_questions').select('user_id, text, created_at').eq('session_id', s.id).order('created_at');
    const questions = (qs ?? []) as { user_id: string; text: string }[];
    const ready = questions.length >= min;
    const dueAt = new Date(new Date(s.starts_at).getTime() - AGENDA_LEAD_HOURS * HOUR);

    // At the deadline: send it, or skip the session.
    if (now >= dueAt) {
      if (ready || (!required && questions.length > 0)) {
        const { data: names } = await supabaseAdmin.from('member_directory').select('id, full_name').in('id', questions.map((q) => q.user_id));
        const first = new Map(((names ?? []) as { id: string; full_name: string | null }[]).map((n) => [n.id, (n.full_name ?? '').trim().split(/\s+/)[0] || 'A member']));
        const lines = questions.map((q) => `${first.get(q.user_id) ?? 'A member'}: ${q.text}`);
        if (mentor?.user_id) {
          const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', mentor.user_id).maybeSingle();
          const email = (p?.email as string | undefined) ?? null;
          if (email) {
            await sendEmailSafe({
              to: email,
              subject: `Agenda for your session with ${ctitle}, ${when(s.starts_at)}`,
              html: buildNoticeEmail({ eyebrow: 'Mentor session agenda', title: `${ctitle} · ${when(s.starts_at)}`, body: `Here’s what the Circle wants to cover in your 20-minute session. ${questions.length} ${questions.length === 1 ? 'question' : 'questions'} from members:`, url: '/sessions/mentoring', label: 'Open the session', lines, recipient: email }),
            });
          }
          await rxNotify(mentor.user_id, { kind: 'agenda_sent', entityId: s.id, url: '/sessions/mentoring', title: `Agenda from ${ctitle}`, body: `For your session ${when(s.starts_at)}: ${questions.length} questions from members.`, lines });
        }
        await rxNotify(await circleAudience(s.circle_id), { kind: 'agenda_sent', entityId: s.id, url: `/sessions/agenda?c=${s.circle_id}`, title: 'Your agenda went to your mentor', body: `${mentor?.name ?? 'Your mentor'} has your ${questions.length} questions for the session ${when(s.starts_at)}.` });
        await supabaseAdmin.from('circle_mentor_sessions').update({ agenda_sent_at: now.toISOString() }).eq('id', s.id);
        sent++;
      } else {
        await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'cancelled', cancel_reason: 'no_agenda' }).eq('id', s.id).eq('status', 'scheduled');
        const { data: next } = await supabaseAdmin.from('circle_mentor_sessions').select('starts_at').eq('circle_mentor_id', s.circle_mentor_id).eq('status', 'scheduled').gt('starts_at', s.starts_at).order('starts_at').limit(1).maybeSingle();
        const nextLine = next?.starts_at ? ` Your next session is ${when(next.starts_at as string)}; get the agenda ready at least 48 hours before.` : '';
        const to = await circleAudience(s.circle_id);
        if (mentor?.user_id) to.push(mentor.user_id);
        await rxNotify(to, { kind: 'session_moved', entityId: s.id, url: `/sessions?c=${s.circle_id}`, title: `The mentor session ${when(s.starts_at)} is skipped`, body: `The agenda wasn’t ready 48 hours before (${questions.length} of ${min} questions), so this session won’t go ahead.${nextLine}` });
        skipped++;
      }
      continue;
    }

    // 72 hours out and not ready: remind the Circle once.
    if (!ready && !s.agenda_reminded_at) {
      await rxNotify(await circleAudience(s.circle_id, { membersOnly: true }), {
        kind: 'agenda_due', entityId: s.id, url: `/sessions/agenda?c=${s.circle_id}`,
        title: 'Add your question for the mentor session',
        body: `The agenda goes to ${mentor?.name ?? 'your mentor'} ${when(dueAt.toISOString())} and needs at least ${min} questions (${questions.length} so far). Without it, the session ${when(s.starts_at)} is skipped.`,
      });
      await supabaseAdmin.from('circle_mentor_sessions').update({ agenda_reminded_at: now.toISOString() }).eq('id', s.id);
      reminded++;
    }
  }
  return { reminded, sent, skipped };
}
