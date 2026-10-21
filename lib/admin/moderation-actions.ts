import 'server-only';
// Moderation logic shared by the console screen. Same behaviour as app/admin/moderation/actions.ts, without the page's own auth
// (the console runner has already checked the teammate's level).
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type ModSource = 'flag' | 'report';

export function parseModId(id: string): { source: ModSource; id: string } | null {
  const [s, rest] = id.split(':');
  if ((s !== 'flag' && s !== 'report') || !rest || !/^[0-9a-f-]{36}$/i.test(rest)) return null;
  return { source: s, id: rest };
}

export async function resolveModItem(source: ModSource, id: string, status: 'dismissed' | 'actioned'): Promise<void> {
  const { error } = await supabaseAdmin.from(source === 'flag' ? 'rx_flags' : 'rx_reports').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/c/moderation');
}

/** A post is hidden (kept for the record), a comment is deleted. Matches removeContent. */
export async function removeModContent(kind: string, refId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(refId)) throw new Error('That item is no longer available.');
  if (kind === 'post') {
    const { error } = await supabaseAdmin.from('feed_posts').update({ deleted: true }).eq('id', refId);
    if (error) throw new Error(error.message);
  } else if (kind === 'comment') {
    const { error } = await supabaseAdmin.from('feed_replies').delete().eq('id', refId);
    if (error) throw new Error(error.message);
  } else throw new Error('Only posts and comments can be removed here.');
  revalidatePath('/community');
}

export async function setModMessagingBlocked(userId: string, blocked: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('member_profile').upsert({ user_id: userId, messaging_blocked: blocked, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/** Who wrote the reported item (the person messaging would be blocked for). */
export async function modAuthorOf(source: ModSource, row: { kind: string; ref_id: string | null; user_id?: string | null; reporter_id?: string | null }): Promise<string | null> {
  if (source === 'flag') return row.user_id ?? null;
  if (!row.ref_id) return null;
  if (row.kind === 'post' || row.kind === 'comment') {
    const { data } = await supabaseAdmin.from(row.kind === 'post' ? 'feed_posts' : 'feed_replies').select('user_id').eq('id', row.ref_id).maybeSingle();
    return (data?.user_id as string | null | undefined) ?? null;
  }
  if (row.kind === 'dm') {
    const { data: t } = await supabaseAdmin.from('dm_threads').select('user_a, user_b').eq('id', row.ref_id).maybeSingle();
    if (!t) return null;
    return (t.user_a as string) === row.reporter_id ? (t.user_b as string) : (t.user_a as string);
  }
  return null;
}
