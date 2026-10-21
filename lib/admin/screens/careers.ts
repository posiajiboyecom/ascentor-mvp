// lib/admin/screens/careers.ts
// Spec copied from the admin prototype (Marketing · Careers). The loader below is a placeholder until it reads real data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "careers",
  group: "Marketing",
  title: "Careers",
  sub: "Roles at Ascentor.",
  cols: [
    "Role",
    "Team",
    "Applicants",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 3,
      to: "Published"
    },
    {
      id: "close",
      label: "Close",
      col: 3,
      to: "Ended"
    }
  ],
  buttons: [
    {
      id: "new-role",
      href: "/admin/careers",
      label: "New role"
    }
  ]
};

// job_listings has only is_active. A role that is off and has applicants has been run, so it reads Ended; off with none reads Draft.
const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('job_listings')
      .select('id, title, department, is_active').order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const apps: Record<string, number> = {};
    const { data: a } = await supabaseAdmin.from('job_applications').select('job_id').limit(20000);
    (a ?? []).forEach((x: any) => { if (x.job_id) apps[x.job_id] = (apps[x.job_id] || 0) + 1; });
    return {
      rows: (data ?? []).map((r: any) => {
        const n = apps[r.id] || 0;
        return { id: String(r.id), cells: [r.title || '-', r.department || '-', n ? count(n) : '-', r.is_active ? 'Published' : n ? 'Ended' : 'Draft'] };
      }),
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'publish' && actionId !== 'close') return { ok: false, error: 'Unknown action.' };
    const { data: row } = await supabaseAdmin.from('job_listings').select('id, title, is_active').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That role no longer exists.' };
    const on = actionId === 'publish';
    if (!!row.is_active === on) return { ok: false, error: on ? 'This role is already published.' : 'This role is not open.' };
    const { error } = await supabaseAdmin.from('job_listings').update({ is_active: on, updated_at: new Date().toISOString() }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this role.' };
    return { ok: true, message: on ? `${row.title} is published.` : `${row.title} is closed.` };
  },
};

export default screen;
