// GET /api/search?q=…
// Global search for the member app's command palette. Runs with the caller's
// own session (not the service role) so row-level security decides what each
// member can see.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Item = { title: string; subtitle?: string; href: string };

const clean = (s: string) => s.replace(/[%*,()\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = clean(req.nextUrl.searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const like = `%${q}%`;

  const [courses, sessions] = await Promise.all([
    supabase.from('courses').select('id, title, category').eq('is_published', true).ilike('title', like).limit(6),
    supabase.from('expert_sessions').select('id, title, expert_name, scheduled_at')
      .eq('status', 'scheduled').or(`title.ilike.${like},expert_name.ilike.${like}`)
      .order('scheduled_at', { ascending: true }).limit(6),
  ]);

  const groups: { label: string; items: Item[] }[] = [];

  const courseItems: Item[] = (courses.data ?? []).map((c: any) => ({
    title: c.title, subtitle: c.category ?? undefined, href: `/learn/${c.id}`,
  }));
  if (courseItems.length) groups.push({ label: 'Courses', items: courseItems });

  const sessionItems: Item[] = (sessions.data ?? []).map((s: any) => ({
    title: s.title,
    subtitle: [s.expert_name, s.scheduled_at
      ? new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })
      : null].filter(Boolean).join(' · '),
    href: '/experts',
  }));
  if (sessionItems.length) groups.push({ label: 'Expert sessions', items: sessionItems });

  return NextResponse.json({ groups });
}
