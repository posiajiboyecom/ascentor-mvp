import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { getMe } from '@/lib/rx/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { relTime } from '@/lib/rx/dates';
import { Aside, Title } from '@/components/rx/ui';
import ModerationClient, { type ModItem } from '@/components/rx/admin/ModerationClient';

export const dynamic = 'force-dynamic';

type Line = { who: string; text: string };

async function nameOf(id: string | null): Promise<string> {
  if (!id) return 'Ascentor';
  const { data } = await supabaseAdmin.from('member_directory').select('full_name').eq('id', id).maybeSingle();
  return ((data?.full_name as string | undefined) ?? '').trim() || 'Member';
}

async function bodyOf(kind: string, id: string): Promise<Line[]> {
  if (kind === 'post' || kind === 'comment') {
    const t = kind === 'post' ? 'feed_posts' : 'feed_replies';
    const { data: row } = await supabaseAdmin.from(t).select('body, user_id').eq('id', id).maybeSingle();
    return row ? [{ who: await nameOf((row.user_id as string | null) ?? null), text: (row.body as string) ?? '' }] : [];
  }
  const table = kind === 'dm' ? 'dm_messages' : kind === 'circle' ? 'circle_messages' : 'rx_group_messages';
  const col = kind === 'dm' ? 'sender_id' : 'user_id';
  const { data } = await supabaseAdmin.from(table).select(`body, ${col}`).eq('id', id).maybeSingle();
  if (!data) return [];
  const row = data as unknown as Record<string, string | null>;
  return [{ who: await nameOf(row[col]), text: row.body ?? '' }];
}

export default async function ModerationPage() {
  const me = await getMe();
  if (!me || !me.isStaff) return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Moderation is for the Ascentor team.</p></div></div>;

  const [{ data: flags }, { data: reports }] = await Promise.all([
    supabaseAdmin.from('rx_flags').select('id, kind, ref_id, user_id, reason, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('rx_reports').select('id, kind, ref_id, reporter_id, reason, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
  ]);

  const items: ModItem[] = [];
  for (const f of (flags ?? []) as { id: string; kind: string; ref_id: string | null; user_id: string | null; reason: string; created_at: string }[]) {
    const { data: mp } = f.user_id ? await supabaseAdmin.from('member_profile').select('messaging_blocked').eq('user_id', f.user_id).maybeSingle() : { data: null };
    items.push({ source: 'flag', id: f.id, kind: f.kind, reason: f.reason, when: relTime(f.created_at), person: f.user_id ? { id: f.user_id, name: await nameOf(f.user_id) } : null, blocked: !!mp?.messaging_blocked, lines: f.ref_id ? await bodyOf(f.kind, f.ref_id) : [] });
  }
  for (const r of (reports ?? []) as { id: string; kind: string; ref_id: string | null; reporter_id: string; reason: string | null; created_at: string }[]) {
    // A report on a direct conversation shows its latest messages so the reviewer can see the context.
    const lines: Line[] = [];
    let other: { id: string; name: string } | null = null;
    if ((r.kind === 'post' || r.kind === 'comment') && r.ref_id) {
      lines.push(...(await bodyOf(r.kind, r.ref_id)));
      const { data: row } = await supabaseAdmin.from(r.kind === 'post' ? 'feed_posts' : 'feed_replies').select('user_id').eq('id', r.ref_id).maybeSingle();
      const authorId = (row?.user_id as string | null | undefined) ?? null;
      if (authorId) other = { id: authorId, name: await nameOf(authorId) };
    }
    if (r.kind === 'dm' && r.ref_id) {
      const { data: t } = await supabaseAdmin.from('dm_threads').select('user_a, user_b').eq('id', r.ref_id).maybeSingle();
      const { data: msgs } = await supabaseAdmin.from('dm_messages').select('sender_id, body, created_at').eq('thread_id', r.ref_id).order('created_at', { ascending: false }).limit(8);
      for (const m of ((msgs ?? []) as { sender_id: string; body: string }[]).reverse()) lines.push({ who: await nameOf(m.sender_id), text: m.body });
      if (t) { const otherId = (t.user_a as string) === r.reporter_id ? (t.user_b as string) : (t.user_a as string); other = { id: otherId, name: await nameOf(otherId) }; }
    }
    const { data: mp } = other ? await supabaseAdmin.from('member_profile').select('messaging_blocked').eq('user_id', other.id).maybeSingle() : { data: null };
    items.push({ source: 'report', id: r.id, kind: r.kind, reason: `${r.reason ?? 'Reported'} (reported by ${await nameOf(r.reporter_id)})`, when: relTime(r.created_at), person: other, blocked: !!mp?.messaging_blocked, lines });
  }

  return (
    <ToastProvider>
      <div className="rx rx-admin-desktop" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>Moderation</Title>
        <div className="rx-two">
          <ModerationClient items={items} />
          <Aside>
            <p className="rx-label">What lands here</p>
            <p className="rx-p">Messages the filters flag (payment or investment pitches with a link or phone number, security-code requests) and conversations members report.</p>
            <p className="rx-sm">Turning messaging off stops a member starting or sending direct messages. They keep their Circle and the rest of the app.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
