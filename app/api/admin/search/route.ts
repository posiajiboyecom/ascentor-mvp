// GET /api/admin/search?q=…
// Global admin search behind the command palette. Cookie-session auth, role
// gate (admin/moderator) and per-source permission checks, so a moderator
// without users.view never sees user records here.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

type Item = { title: string; subtitle?: string; href: string };
type Group = { label: string; items: Item[] };

const LIMIT = 5;
// Characters with meaning inside a PostgREST filter string.
const clean = (s: string) => s.replace(/[%*,()\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function GET(req: NextRequest) {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from('profiles').select('role, permissions').eq('id', user.id).single();
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const can = (p: Permission) =>
    userHasPermission(me.role as UserRole, me.permissions as Permission[] | null, p);

  const q = clean(req.nextUrl.searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const like = `%${q}%`;

  const [users, attempts, summit, courses, posts, sessions] = await Promise.all([
    can('users.view')
      ? supabaseAdmin.from('profiles').select('id, full_name, email, subscription_plan')
          .or(`full_name.ilike.${like},email.ilike.${like}`).limit(LIMIT)
      : Promise.resolve({ data: null }),
    can('payments.view')
      ? supabaseAdmin.from('payment_attempts').select('reference, email, status, kind, amount_kobo')
          .or(`email.ilike.${like},reference.ilike.${like}`).order('created_at', { ascending: false }).limit(LIMIT)
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('summit_registrations').select('id, full_name, email, payment_status')
      .or(`full_name.ilike.${like},email.ilike.${like}`).limit(LIMIT),
    supabaseAdmin.from('courses').select('id, title, category').ilike('title', like).limit(LIMIT),
    supabaseAdmin.from('blog_posts').select('id, title, status').ilike('title', like).limit(LIMIT),
    supabaseAdmin.from('expert_sessions').select('id, title, expert_name').ilike('title', like).limit(LIMIT),
  ]);

  const groups: Group[] = [];
  const push = (label: string, items: Item[]) => { if (items.length) groups.push({ label, items }); };

  push('Users', (users.data ?? []).map((u: any) => ({
    title: u.full_name || u.email || 'Unnamed user',
    subtitle: [u.email, u.subscription_plan].filter(Boolean).join(' · '),
    href: `/admin/users?search=${encodeURIComponent(u.email || u.full_name || q)}`,
  })));
  push('Payments', (attempts.data ?? []).map((a: any) => ({
    title: a.email || a.reference,
    subtitle: `${a.kind} · ${a.status} · ₦${Math.round((a.amount_kobo ?? 0) / 100).toLocaleString('en-NG')}`,
    href: `/admin/payments?q=${encodeURIComponent(a.reference)}`,
  })));
  push('Summit registrations', (summit.data ?? []).map((r: any) => ({
    title: r.full_name, subtitle: `${r.email} · ${r.payment_status === 'paid' ? 'confirmed' : 'not confirmed'}`,
    href: `/admin/elevation-summit/registrations?q=${encodeURIComponent(r.email)}`,
  })));
  push('Courses', (courses.data ?? []).map((c: any) => ({
    title: c.title, subtitle: c.category ?? undefined, href: '/admin/courses',
  })));
  push('Blog posts', (posts.data ?? []).map((b: any) => ({
    title: b.title, subtitle: b.status ?? undefined, href: '/admin/blog',
  })));
  push('Expert sessions', (sessions.data ?? []).map((s: any) => ({
    title: s.title, subtitle: s.expert_name ?? undefined, href: '/admin/experts',
  })));

  return NextResponse.json({ groups });
}
