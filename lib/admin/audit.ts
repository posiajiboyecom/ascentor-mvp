// lib/admin/audit.ts
// Server-only. Every console action is recorded in public.audit_logs with the teammate's name and role, and the Audit log
// screen, the Overview "Recent admin activity" and each row's History read from the same table.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { StaffCtx } from '@/lib/admin/types';

export interface AuditRow { when: string; who: string; what: string; item: string; area: string }

/** Records one admin action. Never throws: a failed log write must not undo or block the action itself. */
export async function auditAdmin(staff: Pick<StaffCtx, 'userId' | 'name' | 'roleName'>, what: string, item: string, area: string): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: staff.userId,
      action: 'admin_console',
      entity_type: area,
      entity_id: item.slice(0, 200),
      details: { what, item, area, who: `${staff.name} · ${staff.roleName}` },
    });
  } catch (e) {
    console.error('[admin audit] could not write:', (e as Error).message);
  }
}

const TZ = 'Africa/Lagos';
function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ });
  const time = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).replace(' am', ' AM').replace(' pm', ' PM');
  if (day(d) === day(now)) return `Today, ${time}`;
  const y = new Date(now.getTime() - 864e5);
  if (day(d) === day(y)) return `Yesterday, ${time}`;
  const diffDays = (now.getTime() - d.getTime()) / 864e5;
  if (diffDays < 7) return `${d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short' })}, ${time}`;
  return `${d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })}, ${time}`;
}

interface LogRow { created_at: string; entity_type: string | null; entity_id: string | null; details: { what?: string; item?: string; area?: string; who?: string } | null; user_id: string | null }

/** Newest first. `item` narrows to one item (a row's History); `limit` caps the list. */
export async function listAudit(opts: { limit?: number; item?: string } = {}): Promise<AuditRow[]> {
  try {
    let q = supabaseAdmin.from('audit_logs').select('created_at, entity_type, entity_id, details, user_id').eq('action', 'admin_console').order('created_at', { ascending: false }).limit(opts.limit ?? 100);
    if (opts.item) q = q.eq('entity_id', opts.item.slice(0, 200));
    const { data } = await q;
    return ((data ?? []) as LogRow[]).map((r) => ({
      when: whenLabel(r.created_at),
      who: r.details?.who ?? 'Teammate',
      what: r.details?.what ?? 'Changed',
      item: r.details?.item ?? r.entity_id ?? '',
      area: r.details?.area ?? r.entity_type ?? '',
    }));
  } catch {
    return [];
  }
}
