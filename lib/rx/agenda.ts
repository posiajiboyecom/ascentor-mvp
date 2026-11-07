// lib/rx/agenda.ts
// Circle agenda: read and edit from the browser with the member's own session. Row level security limits every
// query to the Circle's members (see database/migrations/20261107_circle_agendas.sql).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgendaItem { id: string; position: number; title: string; duration_minutes: number | null }
export interface Agenda {
  id: string;
  circle_id: string;
  current_item_index: number;
  current_item_started_at: string | null;
  updated_at: string;
  updated_by: string | null;
}
export interface LoadedAgenda { agenda: Agenda | null; items: AgendaItem[]; editorName: string | null }

/** The Circle's most recent agenda, its items in order, and the first name of whoever last edited it. */
export async function loadAgenda(sb: SupabaseClient, circleId: string): Promise<LoadedAgenda> {
  const { data: agenda } = await sb
    .from('circle_agendas')
    .select('id, circle_id, current_item_index, current_item_started_at, updated_at, updated_by')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!agenda) return { agenda: null, items: [], editorName: null };
  const [{ data: items }, editor] = await Promise.all([
    sb.from('agenda_items').select('id, position, title, duration_minutes').eq('agenda_id', agenda.id).order('position', { ascending: true }).order('created_at', { ascending: true }),
    agenda.updated_by ? sb.from('member_directory').select('full_name').eq('id', agenda.updated_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const full = (editor.data as { full_name?: string | null } | null)?.full_name ?? null;
  return { agenda: agenda as Agenda, items: (items ?? []) as AgendaItem[], editorName: full ? full.split(/\s+/)[0] : null };
}

/** "just now", "5m ago", "2h ago", "3d ago". */
export function ago(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "08:30" from milliseconds. */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
