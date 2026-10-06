// scripts/seed-fresh-db.ts
// Seeds a FRESH development Supabase project with test users and sample data so every
// member journey can be exercised with `npm run dev`. Safe to re-run (idempotent).
//
//   npm run db:seed-fresh
//
// Reads the fresh project's URL and service-role key from .env.development.local and refuses to
// run if they match the production project in .env.local.
//
// TEST ACCOUNTS (development project only; the addresses use the reserved .test domain):
//   member   member@ascentor.test    Ascent-Test-2026   onboarded member with goal, commitments, sessions
//   newbie   newbie@ascentor.test    Ascent-Test-2026   confirmed but NOT onboarded (tests the onboarding gate)
//   admin    admin@ascentor.test     Ascent-Test-2026   admin: sign in at /admin-login
import fs from 'node:fs';
import { config, parse } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.development.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.development.local');
  process.exit(1);
}
const refOf = (v?: string) => (v ?? '').match(/[a-z]{20}/)?.[0];
const prod = fs.existsSync('.env.local') ? parse(fs.readFileSync('.env.local')) : {};
if (refOf(url) && [refOf(prod.NEXT_PUBLIC_SUPABASE_URL), refOf(prod.DATABASE_URL)].includes(refOf(url))) {
  console.error('Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = 'Ascent-Test-2026';
const day = 86_400_000;
const iso = (offsetDays: number, hour = 10) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

async function ensureUser(email: string, fullName: string) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  return data.user.id;
}

async function must<T>(label: string, p: PromiseLike<{ error: { message: string } | null; data?: T }>) {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function main() {
  console.log('target:', new URL(url!).hostname);

  const memberId = await ensureUser('member@ascentor.test', 'Test Member');
  const newbieId = await ensureUser('newbie@ascentor.test', 'Test Newbie');
  const adminId = await ensureUser('admin@ascentor.test', 'Test Admin');

  await must('profile member', db.from('profiles').upsert({
    id: memberId, email: 'member@ascentor.test', full_name: 'Test Member', role: 'member',
    onboarding_completed: true, ascent_stage: 'Mind', what_building: 'A leadership practice that outlasts me',
    referral_code: 'ASC-MEMBER', subscription_plan: 'builder', subscription_status: 'active',
    subscription_end: iso(60),
  }));
  await must('profile newbie', db.from('profiles').upsert({
    id: newbieId, email: 'newbie@ascentor.test', full_name: 'Test Newbie', role: 'member', onboarding_completed: false,
  }));
  await must('profile admin', db.from('profiles').upsert({
    id: adminId, email: 'admin@ascentor.test', full_name: 'Test Admin', role: 'admin',
    onboarding_completed: true, ascent_stage: 'Work', referral_code: 'ASC-ADMIN',
  }));

  // Goal and commitments for the member (replaced on every run)
  await db.from('user_goals').delete().eq('user_id', memberId);
  await must('goal', db.from('user_goals').insert({
    user_id: memberId, goal_text: 'Launch my coaching practice and sign my first five clients', progress: 0,
    milestone_1: 'Define my offer', milestone_2: 'Publish my first three posts', milestone_3: 'Book five discovery calls',
    milestone_1_completed: true,
  }));
  await db.from('user_commitments').delete().eq('user_id', memberId);
  await must('commitments', db.from('user_commitments').insert([
    { user_id: memberId, commitment_text: 'Write for 30 minutes every morning', completed: true, completed_at: new Date().toISOString(), due_date: iso(6).slice(0, 10) },
    { user_id: memberId, commitment_text: 'Send three outreach messages', completed: false, due_date: iso(6).slice(0, 10) },
    { user_id: memberId, commitment_text: 'Review my weekly numbers on Friday', completed: false, due_date: iso(6).slice(0, 10) },
  ]));

  // Community structure
  const catIds: Record<string, string> = {};
  for (const [name, sort] of [['Navigation', 1], ['Community', 2], ['Circles', 3]] as const) {
    const { data: found } = await db.from('community_categories').select('id').eq('name', name).maybeSingle();
    if (found) { catIds[name] = found.id; continue; }
    const { data, error } = await db.from('community_categories').insert({ name, sort_order: sort, default_type: 'chat' }).select('id').single();
    if (error || !data) throw new Error(`category ${name}: ${error?.message}`);
    catIds[name] = data.id;
  }
  await must('channels', db.from('community_channels').upsert([
    { slug: 'welcome', name: 'Welcome', description: 'Start here', channel_type: 'announce', category_id: catIds.Navigation, sort_order: 1, is_pinned: true },
    { slug: 'general', name: 'General', description: 'The Commons', channel_type: 'forum', category_id: catIds.Community, sort_order: 2, is_pinned: true },
    { slug: 'introductions', name: 'Introductions', description: 'Say hello', channel_type: 'chat', category_id: catIds.Community, sort_order: 3 },
    { slug: 'accountability', name: 'Accountability', description: 'Keep your word', channel_type: 'chat', category_id: catIds.Community, sort_order: 4 },
    { slug: 'circle-alpha', name: 'Circle Alpha', description: 'A small accountability circle', channel_type: 'circle', category_id: catIds.Circles, sort_order: 5 },
  ], { onConflict: 'slug' }));

  // Weekly prompt (Monday of this week)
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const week = monday.toISOString().slice(0, 10);
  await db.from('community_prompts').delete().eq('week_start', week);
  await must('prompt', db.from('community_prompts').insert({ week_start: week, question: 'Where did you keep your word this week when it was hard?' }));

  // A welcome message so channels are not empty
  const { count } = await db.from('community_messages').select('id', { count: 'exact', head: true }).eq('channel', 'welcome');
  if (!count) {
    await must('welcome message', db.from('community_messages').insert({ user_id: adminId, channel: 'welcome', content: 'Welcome to The Circle. Introduce yourself in #introductions.', pinned: true }));
  }

  // Courses
  const { count: courseCount } = await db.from('courses').select('id', { count: 'exact', head: true });
  if (!courseCount) {
    await must('courses', db.from('courses').insert([
      { title: 'The Discipline of Small Promises', description: 'Build trust by keeping the promises nobody checks.', category: 'Character', difficulty: 'beginner', youtube_id: 'dQw4w9WgXcQ', duration: '12 min', sort_order: 1, is_published: true, plan_tier: 'free' },
      { title: 'Thinking Clearly Under Pressure', description: 'A mind that holds steady when the room does not.', category: 'Mind', difficulty: 'intermediate', youtube_id: 'dQw4w9WgXcQ', duration: '18 min', sort_order: 2, is_published: true, plan_tier: 'explorer' },
      { title: 'Work That Outlasts You', description: 'Choose projects by what they will still mean in a decade.', category: 'Legacy', difficulty: 'advanced', youtube_id: 'dQw4w9WgXcQ', duration: '25 min', sort_order: 3, is_published: true, plan_tier: 'builder' },
    ]));
  }

  // Expert sessions (one tomorrow, one next week) both shapes of columns are filled
  await db.from('expert_sessions').delete().in('title', ['Leading Through Uncertainty', 'Negotiating Your Worth']);
  await must('sessions', db.from('expert_sessions').insert([
    { title: 'Leading Through Uncertainty', description: 'A live conversation on decisions with incomplete information.', expert_name: 'Amara Obi', expert_bio: 'Mentored leaders across three continents', scheduled_at: iso(1, 17), duration_minutes: 60, max_participants: 50, max_attendees: 50, status: 'scheduled', plan_tier: 'free', category: 'Mind', dimension: 'Mind', join_url: 'https://example.com/live', meeting_url: 'https://example.com/live', is_free: true },
    { title: 'Negotiating Your Worth', description: 'Scripts and practice for the conversation you keep postponing.', expert_name: 'Kofi Mensah', expert_bio: 'Executive coach and former CFO', scheduled_at: iso(7, 15), duration_minutes: 75, max_participants: 40, max_attendees: 40, status: 'scheduled', plan_tier: 'builder', category: 'Vocation', dimension: 'Vocation', join_url: 'https://example.com/live2', meeting_url: 'https://example.com/live2', is_free: false },
  ]));

  console.log('\nseeded. Sign in with member@ascentor.test, newbie@ascentor.test or admin@ascentor.test (/admin-login).');
  console.log('The shared test password is defined at the top of scripts/seed-fresh-db.ts.');
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
