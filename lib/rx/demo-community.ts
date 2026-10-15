// lib/rx/demo-community.ts
// Demo posts, comments and reactions for the Community feed, written by demo members, so the feed looks alive while testing.
// Like the rest of the demo data it never emails or notifies anyone, and resetDemo removes it all.
//
// No 'server-only' import on purpose: scripts/seed-demo.ts and the Demo lab both call it with a service-role client.

import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient;

interface DemoPost {
  category: string; type: 'Question' | 'Win' | 'Reflection' | 'Resource'; html: string; text: string; hoursAgo: number;
  comments: { text: string; hoursAgo: number; reply?: string }[]; reactions: number;
}

const p = (t: string) => `<p>${t}</p>`;

export const DEMO_POSTS: DemoPost[] = [
  { category: 'Wins', type: 'Win', hoursAgo: 5, reactions: 6,
    html: p('Finished my first <strong>full lab</strong> this week. Three things I learned:') + '<ul><li>Read the logs before touching anything</li><li>Write down every step</li><li>Ask for help sooner</li></ul>',
    text: 'Finished my first full lab this week. Three things I learned: read the logs before touching anything, write down every step, ask for help sooner.',
    comments: [{ text: 'Great work. Which lab was it?', hoursAgo: 4, reply: 'The log analysis one. It took three evenings.' }, { text: 'Writing down every step is the real skill. Well done.', hoursAgo: 3 }] },
  { category: 'Questions', type: 'Question', hoursAgo: 11, reactions: 3,
    html: p('How do you keep studying when work runs late? I plan 30 minutes each evening and then I am too tired.'),
    text: 'How do you keep studying when work runs late? I plan 30 minutes each evening and then I am too tired.',
    comments: [{ text: 'I moved mine to 6 AM. Ten minutes, before anything else.', hoursAgo: 9 }, { text: 'Tie it to something you already do, like after dinner. If work runs late, do five minutes only.', hoursAgo: 8, reply: 'That "if work runs late" rule is going on my plan today.' }] },
  { category: 'Reflections', type: 'Reflection', hoursAgo: 26, reactions: 5,
    html: p('A small thing I practised this week: saying <em>no</em> to one request that did not fit my goal. It helped my team too, because the person found someone better placed.'),
    text: 'A small thing I practised this week: saying no to one request that did not fit my goal. It helped my team too, because the person found someone better placed.',
    comments: [{ text: 'This is harder than it sounds. Thank you for sharing.', hoursAgo: 24 }] },
  { category: 'Resources', type: 'Resource', hoursAgo: 40, reactions: 4,
    html: p('A free guide I found useful for budgeting on an irregular income:') + '<blockquote>Pay yourself first, even if it is a small amount.</blockquote>' + p('It changed how I plan the month.'),
    text: 'A free guide I found useful for budgeting on an irregular income: pay yourself first, even if it is a small amount. It changed how I plan the month.',
    comments: [{ text: 'Do you plan by week or by month?', hoursAgo: 38, reply: 'By week. Monthly felt too far away.' }] },
  { category: 'Cybersecurity', type: 'Reflection', hoursAgo: 52, reactions: 2,
    html: p('New to cybersecurity. Which entry-level certificate would you start with, and why?'),
    text: 'New to cybersecurity. Which entry-level certificate would you start with, and why?',
    comments: [{ text: 'Start with the fundamentals and build a home lab. Certificates matter less than what you can show.', hoursAgo: 50 }, { text: 'Agreed. A simple write-up of one lab beats a long list of courses.', hoursAgo: 49 }] },
  { category: 'AI and technology', type: 'Reflection', hoursAgo: 70, reactions: 3,
    html: p('Built a small tool that summarises my weekly notes. <strong>Prompting with care</strong> made the difference: one clear task per request.'),
    text: 'Built a small tool that summarises my weekly notes. Prompting with care made the difference: one clear task per request.',
    comments: [{ text: 'Would love to see how you structured the prompt.', hoursAgo: 66 }] },
  { category: 'Faith and purpose', type: 'Reflection', hoursAgo: 90, reactions: 7,
    html: p('On slow days I ask one question: <em>who does today\'s work serve?</em> It brings the meaning back.'),
    text: "On slow days I ask one question: who does today's work serve? It brings the meaning back.",
    comments: [{ text: 'Needed this today. Thank you.', hoursAgo: 88 }, { text: 'Same here. I wrote it on a card for my desk.', hoursAgo: 85 }] },
  { category: 'Money and business', type: 'Question', hoursAgo: 120, reactions: 2,
    html: p('How do you price your first paid project? I keep undercharging because I am afraid of losing the client.'),
    text: 'How do you price your first paid project? I keep undercharging because I am afraid of losing the client.',
    comments: [{ text: 'Price the result, not your hours. Then add a little more than feels comfortable.', hoursAgo: 118 }] },
  { category: 'Careers', type: 'Win', hoursAgo: 140, reactions: 5,
    html: p('Got my first interview invite after rewriting my CV around <strong>what I delivered</strong>, not my job titles.'),
    text: 'Got my first interview invite after rewriting my CV around what I delivered, not my job titles.',
    comments: [{ text: 'Congratulations. Proud of you.', hoursAgo: 138 }] },
];

const KINDS = ['like', 'support', 'insight'] as const;

/** Whether demo members have already written posts. */
export async function demoPostsExist(admin: Admin): Promise<boolean> {
  const { data: demo } = await admin.from('member_profile').select('user_id').eq('is_demo', true);
  const ids = ((demo ?? []) as { user_id: string }[]).map((d) => d.user_id);
  if (!ids.length) return false;
  const { count } = await admin.from('feed_posts').select('id', { count: 'exact', head: true }).in('user_id', ids);
  return (count ?? 0) > 0;
}

export async function seedDemoCommunity(admin: Admin): Promise<{ posts: number; comments: number; reactions: number }> {
  const { data: demo } = await admin.from('member_profile').select('user_id').eq('is_demo', true).eq('is_facilitator', false);
  const ids = ((demo ?? []) as { user_id: string }[]).map((d) => d.user_id);
  if (ids.length < 4) throw new Error('Create the demo Circles first. They provide the demo members who write the posts.');
  if (await demoPostsExist(admin)) throw new Error('Demo posts already exist. Remove the demo data first to rebuild them.');

  const { data: cats } = await admin.from('feed_categories').select('name');
  const valid = new Set(((cats ?? []) as { name: string }[]).map((c) => c.name));
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  let comments = 0; let reactions = 0; let posts = 0;

  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const d = DEMO_POSTS[i];
    const author = ids[i % ids.length];
    const row = await admin.from('feed_posts').insert({
      user_id: author, type: d.type, category: valid.has(d.category) ? d.category : null, body: d.text, body_html: d.html, created_at: ago(d.hoursAgo),
    }).select('id').single();
    if (row.error || !row.data) throw new Error(`post ${i + 1}: ${row.error?.message ?? 'no row'}`);
    const postId = row.data.id as string;
    posts++;

    for (let c = 0; c < d.comments.length; c++) {
      const cm = d.comments[c];
      const commenter = ids[(i + c + 1) % ids.length];
      const top = await admin.from('feed_replies').insert({ post_id: postId, user_id: commenter, body: cm.text, created_at: ago(cm.hoursAgo) }).select('id').single();
      if (top.error || !top.data) throw new Error(`comment: ${top.error?.message ?? 'no row'}`);
      comments++;
      if (cm.reply) {
        await admin.from('feed_replies').insert({ post_id: postId, user_id: author, body: cm.reply, parent_id: top.data.id, created_at: ago(Math.max(0, cm.hoursAgo - 1)) });
        comments++;
      }
    }

    const reactors = ids.filter((u) => u !== author).slice(i % 3, (i % 3) + d.reactions);
    if (reactors.length) {
      await admin.from('feed_reactions').insert(reactors.map((user_id, k) => ({ post_id: postId, user_id, kind: KINDS[(i + k) % 3] })));
      reactions += reactors.length;
    }
  }
  return { posts, comments, reactions };
}

/** Removes everything demo members wrote in Community. Must run before their accounts are deleted, or the rows are orphaned. */
export async function removeDemoCommunity(admin: Admin, demoUserIds: string[]): Promise<void> {
  if (!demoUserIds.length) return;
  await admin.from('feed_reactions').delete().in('user_id', demoUserIds);
  await admin.from('feed_replies').delete().in('user_id', demoUserIds);
  await admin.from('feed_posts').delete().in('user_id', demoUserIds);
}
