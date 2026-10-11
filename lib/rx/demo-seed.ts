// lib/rx/demo-seed.ts
// Demo Circles for testing, so nobody waits for real members to fill seats.
//
// Five interest Circles at different stages, each with a few seats held open for a real tester:
//   Cybersecurity       5 of 8, not started. Joining makes 6 and starts the cycle.
//   AI and technology   6 of 8, a mentor vote is open and part-way through.
//   Money and business  6 of 8, a mentor said yes. Times are being picked, one time is one mark short.
//   Faith and purpose   7 of 8, a mentor is active with booked sessions, an agreement and a call you can open.
//   Careers             3 of 8, just forming.
//
// Everything created here is flagged is_demo. Demo members never receive email or push, demo Circles are shown to staff
// only, and demo mentors are never recommended to real Circles. resetDemo removes all of it.
//
// No 'server-only' import on purpose: the seed script (scripts/seed-demo.ts) and the admin Demo lab both call it with a
// service-role client.

import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient;

export const DEMO_EMAIL_DOMAIN = 'demo.joinascentor.invalid';

const NAMES = [
  'Amaka Obi', 'Chidi Okeke', 'Funmi Adeyemi', 'Tola Bakare', 'Ibrahim Musa', 'Ngozi Eze', 'Seyi Ajayi', 'Zainab Bello', 'Emeka Nwosu', 'Halima Yusuf',
  'Bola Ogunleye', 'Kelechi Anya', 'Yetunde Balogun', 'Tunde Coker', 'Ife Olawale', 'Uche Madu', 'Aisha Lawal', 'Dayo Fashola', 'Nkechi Obiora', 'Femi Adebayo',
  'Sola Akin', 'Chioma Udoh', 'Kunle Adeniran', 'Bisi Alabi', 'Gbenga Olatunji', 'Hauwa Danjuma', 'Ikenna Okafor', 'Jide Salami', 'Kemi Oyinlola', 'Lola Sanni',
  'Mayowa Ige', 'Nneka Chukwu', 'Obinna Ezeh', 'Peju Shola', 'Rotimi Adu', 'Simi Ojo', 'Tobi Ayodele', 'Uju Nnadi', 'Wale Adeniyi', 'Yemi Fashina',
  'Adaora Eze', 'Bayo Ogun', 'Cynthia Obi', 'Dele Martins', 'Efe Okoro', 'Fatima Garba', 'Gozie Umeh', 'Hope Etim', 'Idris Abubakar', 'Joy Ekpo',
];

interface Spec {
  interest: string; members: number; status: 'forming' | 'active'; cycleDaysAgo: number | null; memberInterests: string[];
}
const SPECS: Spec[] = [
  { interest: 'Cybersecurity', members: 5, status: 'forming', cycleDaysAgo: null, memberInterests: ['Cybersecurity', 'Learning how to learn'] },
  { interest: 'AI and technology', members: 6, status: 'active', cycleDaysAgo: 2, memberInterests: ['AI engineering', 'Focus'] },
  { interest: 'Money and business', members: 6, status: 'active', cycleDaysAgo: 9, memberInterests: ['Personal finance', 'Small business finance', 'Entrepreneurship'] },
  { interest: 'Faith and purpose', members: 7, status: 'active', cycleDaysAgo: 30, memberInterests: ['Giving', 'Mentoring others', 'Discipline'] },
  { interest: 'Careers', members: 3, status: 'forming', cycleDaysAgo: null, memberInterests: ['Design', 'Writing'] },
];

const MENTORS = [
  { name: 'Adaeze Nwosu', headline: 'Product designer and engineering lead', tags: ['AI engineering', 'Design', 'Focus'], bio: 'Leads a product team in Lagos. Helps people turn a plan into weekly habits.' },
  { name: 'Kunle Ojo', headline: 'Security engineer', tags: ['Cybersecurity', 'Learning how to learn'], bio: 'Works in application security. Happy to talk about first jobs in the field.' },
  { name: 'Sade Musa', headline: 'Founder and small-business coach', tags: ['Personal finance', 'Small business finance', 'Entrepreneurship', 'Business growth'], bio: 'Runs a food business. Coaches on pricing, saving and steady growth.' },
  { name: 'Pastor Dele Akin', headline: 'Community leader and mentor', tags: ['Giving', 'Mentoring others', 'Discipline', 'Building something lasting'], bio: 'Twenty years of mentoring young leaders. Talks about purpose and service.' },
  { name: 'Ngozi Eke', headline: 'Career coach', tags: ['Design', 'Writing', 'Communication'], bio: 'Helps people move into the work they want and prepare for interviews.' },
  { name: 'Tayo Bankole', headline: 'Data scientist', tags: ['AI engineering', 'Critical thinking'], bio: 'Builds machine learning products. Likes simple explanations.' },
];

const slugOf = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
const day = 86400000;

/** 18:00 UTC is 19:00 in Lagos. */
function slotTimes(daysAhead: number[]): string[] {
  const out: string[] = [];
  for (const d of daysAhead) for (const h of [17, 18]) {
    const t = new Date(Date.now() + d * day); t.setUTCHours(h, 0, 0, 0); out.push(t.toISOString());
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function must(label: string, p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<any> {
  const { data, error } = await p;
  if (error || data === null || data === undefined) throw new Error(`${label}: ${error?.message ?? 'no data'}`);
  return data;
}

async function createDemoUser(admin: Admin, name: string, index: number, opts: { interests: string[]; facilitator?: boolean }): Promise<string> {
  const email = `demo-${index}-${slugOf(name)}@${DEMO_EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, password: `Demo-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    user_metadata: { full_name: name, is_demo: true },
  });
  if (error || !data.user) throw new Error(`create ${name}: ${error?.message ?? 'no user'}`);
  const id = data.user.id;
  await admin.from('profiles').upsert({ id, full_name: name, onboarding_completed: true }, { onConflict: 'id' });
  await must('member_profile', admin.from('member_profile').upsert({
    user_id: id, interests: opts.interests, language: 'English', stage: 'Building', timezone: 'Africa/Lagos', timezone_label: 'Lagos (WAT)', city: 'Lagos', country: 'Nigeria',
    slots: ['Weekday evenings'], onboarded_at: new Date().toISOString(), onboarding_step: 'forming', chat_consent_at: new Date().toISOString(),
    is_demo: true, is_facilitator: !!opts.facilitator,
  }, { onConflict: 'user_id' }).select('user_id'));
  return id;
}

export async function demoExists(admin: Admin): Promise<boolean> {
  const { count } = await admin.from('circles').select('id', { count: 'exact', head: true }).eq('is_demo', true);
  return (count ?? 0) > 0;
}

/** Creates one more demo member and seats them (used by the Demo lab to fill a Circle). */
export async function addDemoMember(admin: Admin, circleId: string): Promise<string> {
  const { count: used } = await admin.from('member_profile').select('user_id', { count: 'exact', head: true }).eq('is_demo', true);
  const n = (used ?? 0) + 1;
  const { data: c } = await admin.from('circles').select('interest').eq('id', circleId).maybeSingle();
  const id = await createDemoUser(admin, `${NAMES[n % NAMES.length]}`, 100 + n, { interests: [(c?.interest as string | undefined) ?? 'Focus'] });
  await admin.from('circle_seats').insert({ circle_id: circleId, user_id: id, role: 'member', pledged_at: new Date().toISOString() });
  const { count } = await admin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
  if ((count ?? 0) >= 6) await admin.from('circles').update({ status: 'active', cycle_start: new Date().toISOString().slice(0, 10) }).eq('id', circleId).is('cycle_start', null);
  return id;
}

export async function seedDemo(admin: Admin, log: (m: string) => void = () => undefined): Promise<{ circles: { id: string; interest: string }[] }> {
  if (await demoExists(admin)) throw new Error('Demo Circles already exist. Reset them first.');

  // mentors and their open times
  const mentorIds: string[] = [];
  for (const m of MENTORS) {
    const row = await must('mentor', admin.from('human_mentors').insert({ name: m.name, headline: m.headline, bio: m.bio, tags: m.tags, langs: ['English'], formats: ['Voice'], capacity: 4, accepting: true, active: true, is_demo: true }).select('id').single());
    mentorIds.push((row as { id: string }).id);
    await admin.from('mentor_slots').insert(slotTimes([3, 4, 5, 6, 8, 10, 12]).map((starts_at) => ({ mentor_id: (row as { id: string }).id, starts_at })));
  }
  log(`mentors: ${mentorIds.length}`);
  const mentorByName = new Map(MENTORS.map((m, i) => [m.name, mentorIds[i]]));

  const { data: last } = await admin.from('circles').select('number').order('number', { ascending: false }).limit(1).maybeSingle();
  let number = ((last?.number as number | undefined) ?? 0) + 1;
  let nameIx = 0; let userIx = 0;
  const made: { id: string; interest: string }[] = [];
  const seated = new Map<string, string[]>();

  for (const spec of SPECS) {
    const facId = await createDemoUser(admin, `${NAMES[40 + (nameIx % 10)]} (facilitator)`, ++userIx, { interests: [spec.interest], facilitator: true });
    nameIx++;
    const cycle = spec.cycleDaysAgo === null ? null : new Date(Date.now() - spec.cycleDaysAgo * day).toISOString().slice(0, 10);
    const circle = await must('circle', admin.from('circles').insert({
      name: 'Lagos Builders', number: number++, status: spec.status, facilitator_id: facId, timezone: 'Africa/Lagos', language: 'English',
      cycle_start: cycle, meeting_dow: 4, meeting_time: '19:00', interest: spec.interest, is_demo: true,
    }).select('id').single());
    const cid = (circle as { id: string }).id;
    made.push({ id: cid, interest: spec.interest });
    await admin.from('circle_seats').insert({ circle_id: cid, user_id: facId, role: 'facilitator' });

    const ids: string[] = [];
    for (let i = 0; i < spec.members; i++) {
      const uid = await createDemoUser(admin, NAMES[(nameIx++) % 40], ++userIx, { interests: spec.memberInterests });
      ids.push(uid);
    }
    await admin.from('circle_seats').insert(ids.map((user_id) => ({ circle_id: cid, user_id, role: 'member', pledged_at: new Date().toISOString() })));
    seated.set(cid, ids);

    const chat = [
      { user_id: null, body: 'Welcome, everyone. Tell us your name and one thing you are working on.', pinned: true },
      { user_id: ids[0], body: `Hi all. Glad to be here. I joined for ${spec.interest.toLowerCase()}.`, pinned: false },
      { user_id: ids[1] ?? ids[0], body: 'Hello. Looking forward to the first call.', pinned: false },
    ];
    await admin.from('circle_messages').insert(chat.map((m) => ({ circle_id: cid, user_id: m.user_id, body: m.body, pinned: m.pinned, kind: 'text' })));
    log(`circle ${spec.interest}: ${ids.length} members`);
  }

  const circleOf = (interest: string) => made.find((c) => c.interest === interest)!.id;
  const slotsOf = async (mentorId: string) => (await must('slots', admin.from('mentor_slots').select('id, starts_at').eq('mentor_id', mentorId).order('starts_at'))) as { id: string; starts_at: string }[];

  // AI and technology: a vote is open, 4 of 6 have voted
  {
    const cid = circleOf('AI and technology'); const ids = seated.get(cid)!;
    const round = (await must('round', admin.from('circle_mentor_rounds').insert({ circle_id: cid, status: 'open', closes_at: new Date(Date.now() + 4 * day).toISOString() }).select('id').single())) as { id: string };
    const cands = [['Adaeze Nwosu', 'Fits 5 of your 6 members on AI engineering and Focus.', 14], ['Tayo Bankole', 'Fits 3 of your 6 members on AI engineering.', 9], ['Ngozi Eke', 'Has open capacity for a new Circle.', 3]] as const;
    await admin.from('circle_mentor_candidates').insert(cands.map(([n, why, score]) => ({ round_id: round.id, circle_id: cid, mentor_id: mentorByName.get(n)!, why, score })));
    const votes = [['Adaeze Nwosu', ids[0]], ['Adaeze Nwosu', ids[1]], ['Tayo Bankole', ids[2]], ['Ngozi Eke', ids[3]]] as const;
    await admin.from('circle_mentor_votes').insert(votes.map(([n, user_id]) => ({ round_id: round.id, circle_id: cid, mentor_id: mentorByName.get(n)!, user_id })));
  }

  // Money and business: Sade said yes, times are being picked, one mark short of booking
  {
    const cid = circleOf('Money and business'); const ids = seated.get(cid)!;
    const sade = mentorByName.get('Sade Musa')!;
    const round = (await must('round', admin.from('circle_mentor_rounds').insert({ circle_id: cid, status: 'closed', winner_mentor_id: sade, closes_at: new Date(Date.now() - 2 * day).toISOString() }).select('id').single())) as { id: string };
    await admin.from('circle_mentor_candidates').insert([{ round_id: round.id, circle_id: cid, mentor_id: sade, why: 'Fits 5 of your 6 members on personal finance and entrepreneurship.', score: 15 }]);
    await admin.from('circle_mentor_votes').insert(ids.map((user_id) => ({ round_id: round.id, circle_id: cid, mentor_id: sade, user_id })));
    const cm = (await must('cm', admin.from('circle_mentors').insert({ circle_id: cid, mentor_id: sade, round_id: round.id, status: 'scheduling' }).select('id').single())) as { id: string };
    const slots = await slotsOf(sade);
    const best = slots[2]; const second = slots[3];
    await admin.from('slot_marks').insert([
      ...ids.slice(0, 5).map((user_id) => ({ circle_mentor_id: cm.id, circle_id: cid, slot_id: best.id, user_id })),
      ...ids.slice(0, 3).map((user_id) => ({ circle_mentor_id: cm.id, circle_id: cid, slot_id: second.id, user_id })),
    ]);
  }

  // Faith and purpose: a mentor is active, sessions are booked, there is an agreement and a call you can open
  {
    const cid = circleOf('Faith and purpose'); const ids = seated.get(cid)!;
    const dele = mentorByName.get('Pastor Dele Akin')!;
    const round = (await must('round', admin.from('circle_mentor_rounds').insert({ circle_id: cid, status: 'closed', winner_mentor_id: dele, closes_at: new Date(Date.now() - 20 * day).toISOString() }).select('id').single())) as { id: string };
    await admin.from('circle_mentor_candidates').insert([{ round_id: round.id, circle_id: cid, mentor_id: dele, why: 'Fits 6 of your 7 members on giving and mentoring.', score: 18 }]);
    await admin.from('circle_mentor_votes').insert(ids.map((user_id) => ({ round_id: round.id, circle_id: cid, mentor_id: dele, user_id })));
    const cm = (await must('cm', admin.from('circle_mentors').insert({ circle_id: cid, mentor_id: dele, round_id: round.id, status: 'active', started_at: new Date(Date.now() - 12 * day).toISOString() }).select('id').single())) as { id: string };
    const first = new Date(Date.now() + 3 * day); first.setUTCHours(18, 0, 0, 0);
    const sessions = Array.from({ length: 6 }, (_, i) => ({ circle_mentor_id: cm.id, circle_id: cid, mentor_id: dele, starts_at: new Date(first.getTime() + i * 14 * day).toISOString(), duration_min: 20 }));
    const rows = (await must('sessions', admin.from('circle_mentor_sessions').insert(sessions).select('id, starts_at'))) as { id: string; starts_at: string }[];
    const next = rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    await admin.from('session_rsvps').insert(ids.slice(0, 4).map((user_id) => ({ session_id: next.id, circle_id: cid, user_id, status: 'going' })));
    await admin.from('mentor_questions').insert([
      { session_id: next.id, circle_id: cid, user_id: ids[0], text: 'How do you keep serving others when your own work is heavy?' },
      { session_id: next.id, circle_id: cid, user_id: ids[2], text: 'What helped you stay consistent in your first year of mentoring?' },
    ]);
    const goals = await must('goals', admin.from('agreement_goals').insert([
      { circle_mentor_id: cm.id, circle_id: cid, text: 'Each of us mentors one person this quarter', position: 0 },
      { circle_mentor_id: cm.id, circle_id: cid, text: 'Give a little every month, on a plan', position: 1 },
    ]).select('id'));
    void goals;
    await admin.from('agreement_tasks').insert([
      { circle_mentor_id: cm.id, circle_id: cid, task: 'Write down one person to mentor', owner_id: ids[0], due: new Date(Date.now() + 10 * day).toISOString().slice(0, 10), owner_confirmed: true, mentor_confirmed: true },
      { circle_mentor_id: cm.id, circle_id: cid, task: 'Set a monthly giving amount', owner_id: ids[1], due: new Date(Date.now() + 14 * day).toISOString().slice(0, 10), owner_confirmed: true },
      { circle_mentor_id: cm.id, circle_id: cid, task: 'Share one lesson from serving', owner_id: ids[2], due: new Date(Date.now() + 14 * day).toISOString().slice(0, 10) },
    ]);
    await admin.from('circles').update({ demo_call_until: new Date(Date.now() + 8 * 3600000).toISOString() }).eq('id', cid);
  }

  return { circles: made };
}

/** Removes every demo Circle, demo mentor and demo member. Real members who joined a demo Circle simply lose that seat. */
export async function resetDemo(admin: Admin): Promise<{ users: number; circles: number }> {
  const { data: users } = await admin.from('member_profile').select('user_id').eq('is_demo', true);
  const ids = ((users ?? []) as { user_id: string }[]).map((u) => u.user_id);
  const { data: circles } = await admin.from('circles').select('id').eq('is_demo', true);
  await admin.from('circles').delete().eq('is_demo', true);
  await admin.from('human_mentors').delete().eq('is_demo', true);
  if (ids.length) {
    await admin.from('profiles').delete().in('id', ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
  return { users: ids.length, circles: (circles ?? []).length };
}
