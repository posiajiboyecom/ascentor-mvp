import 'server-only';
// Shared by the Circles, Groups and Posts consoles (app/admin/c/{circles,groups,categories}/actions.ts):
// the level check, readable errors, and looking people up by id or by a search.
import { staffForAction, type Staff } from '@/lib/admin/access';
import { can, type Level } from '@/lib/admin/areas';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** A message safe to show a teammate: our own errors pass through, database detail does not. */
export function fail(e: unknown, fallback = 'That didn’t work. Please try again.'): { ok: false; error: string } {
  const m = e instanceof Error ? e.message : '';
  return { ok: false, error: m && m.length < 220 && !/supabase|postgres|relation|column|violates|syntax|jwt|fetch failed/i.test(m) ? m : fallback };
}

export async function staffAt(area: string, need: Level, what: string): Promise<Staff> {
  const staff = await staffForAction();
  if (!can(staff.level(area), need)) {
    throw new Error(need === 'full' ? `Only teammates with full access to ${what} can do this.` : need === 'edit' ? `Your role can view ${what} but not change it.` : `Your role can’t open ${what}.`);
  }
  return staff;
}

export const isId = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
export function needId(s: unknown, what = 'item'): string {
  if (!isId(s)) throw new Error(`That ${what} wasn’t found.`);
  return s;
}

export interface Person { id: string; name: string; email: string | null; avatar: string | null }

export async function people(ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, Person>();
  for (let i = 0; i < uniq.length; i += 300) {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', uniq.slice(i, i + 300));
    for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[]) {
      out.set(p.id, { id: p.id, name: p.full_name?.trim() || p.email?.split('@')[0] || 'Member', email: p.email, avatar: p.avatar_url });
    }
  }
  return out;
}

/** Members whose name or email contains the text, for "add a member" pickers. */
export async function findPeople(raw: string, limit = 12): Promise<Person[]> {
  const q = String(raw ?? '').replace(/[%_,()*\\]/g, ' ').trim().slice(0, 80);
  if (q.length < 2) return [];
  const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).order('full_name').limit(limit);
  if (error) throw error;
  return ((data ?? []) as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[])
    .map((p) => ({ id: p.id, name: p.full_name?.trim() || p.email?.split('@')[0] || 'Member', email: p.email, avatar: p.avatar_url }));
}

export const clean = (v: unknown, max: number): string => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
