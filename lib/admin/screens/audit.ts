// lib/admin/screens/audit.ts
// Insights · Audit log: every admin action with who did it and when (prototype: cols When, Who, Action, Item, Area).
import { listAudit } from '@/lib/admin/audit';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: 'audit',
  group: 'Insights',
  title: 'Audit log',
  sub: 'Every admin action, with who did it and when.',
  cols: ['When', 'Who', 'Action', 'Item', 'Area'],
  statusCol: -1,
  actions: [],
  buttons: [{ id: 'export', label: 'Export', needs: 'full' }],
};

const csv = (v: string) => `"${v.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

const screen: ScreenModule = {
  spec,
  async load() {
    const rows = await listAudit({ limit: 300 });
    return { rows: rows.map((r, i) => ({ id: String(i), cells: [r.when, r.who, r.what, r.item, r.area] })), note: rows.length >= 300 ? 'Showing the 300 newest actions.' : undefined };
  },
  async button(ctx, id) {
    if (id !== 'export') return { ok: false, error: 'Unknown button.' };
    ctx.require('audit', 'full');
    const rows = await listAudit({ limit: 5000 });
    const lines = [spec.cols.map(csv).join(','), ...rows.map((r) => [r.when, r.who, r.what, r.item, r.area].map(csv).join(','))];
    return { ok: true, message: `Exported ${rows.length} actions.`, download: { filename: 'audit-log.csv', mime: 'text/csv', content: lines.join('\n') } };
  },
};
export default screen;
