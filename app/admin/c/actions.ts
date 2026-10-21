'use server';

// Server actions behind every console list screen. The ORDER matters and is the security model:
//   1. who is this teammate (real role, never the "view as" preview)
//   2. is the level for THIS area high enough for THIS action  (edit, or full for export / delete / refund)
//   3. only then run the screen's handler
//   4. record it in the audit log with the teammate's name
// A hidden menu item or a disabled button is not protection; this is.

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getScreen } from '@/lib/admin/screens';
import { staffForAction, VIEW_AS_COOKIE } from '@/lib/admin/access';
import { auditAdmin, listAudit, type AuditRow } from '@/lib/admin/audit';
import type { ActionResult } from '@/lib/admin/types';

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"`;

const fail = (e: unknown, fallback = 'That did not work. Please try again.'): ActionResult => ({
  ok: false,
  error: e instanceof Error && e.message ? e.message : fallback,
});

export async function runRowAction(area: string, actionId: string, rowId: string, row: string[]): Promise<ActionResult> {
  try {
    const staff = await staffForAction();
    const screen = await getScreen(area);
    if (!screen) return { ok: false, error: 'Unknown screen.' };
    const action = screen.spec.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, error: 'Unknown action.' };

    staff.require(area, action.admin || action.danger ? 'full' : 'edit');
    if (!screen.act) return { ok: false, error: 'This action is not connected yet.' };

    const result = await screen.act(staff, actionId, String(rowId), Array.isArray(row) ? row.map(String) : []);
    if (!result.ok) return result;

    await auditAdmin(staff, action.label, row?.[0] || rowId, screen.spec.title);
    revalidatePath(`/admin/c/${area}`);
    return { ...result, message: result.message ?? action.done ?? `${action.label} · ${row?.[0] ?? ''}`.trim(), refresh: true };
  } catch (e) {
    return fail(e);
  }
}

export async function runButton(area: string, buttonId: string): Promise<ActionResult> {
  try {
    const staff = await staffForAction();
    const screen = await getScreen(area);
    if (!screen) return { ok: false, error: 'Unknown screen.' };
    const isExport = buttonId === 'export' || buttonId.startsWith('export-');
    const declared = screen.spec.buttons?.find((b) => b.id === buttonId);
    // Export is always offered (as in the prototype) and always needs Full access.
    if (!declared && !(isExport && buttonId === 'export')) return { ok: false, error: 'Unknown button.' };
    staff.require(area, isExport ? 'full' : declared?.needs ?? 'edit');

    let result: ActionResult;
    if (screen.button) {
      result = await screen.button(staff, buttonId);
    } else if (isExport) {
      // Default export: the screen's own rows as CSV.
      const data = await screen.load(staff);
      const lines = [screen.spec.cols.map(csvCell).join(','), ...data.rows.map((r) => r.cells.map(csvCell).join(','))];
      result = { ok: true, message: `Exported ${data.rows.length} rows.`, download: { filename: `${area}.csv`, mime: 'text/csv', content: lines.join('\n') } };
    } else {
      result = { ok: false, error: 'This button is not connected yet.' };
    }
    if (result.ok) {
      await auditAdmin(staff, isExport ? 'Exported (CSV)' : (declared?.label ?? buttonId), screen.spec.title, 'Exports');
      if (result.refresh) revalidatePath(`/admin/c/${area}`);
    }
    return result;
  } catch (e) {
    return fail(e);
  }
}

/** History for the drawer: the audit entries about one item. */
export async function loadHistory(area: string, item: string): Promise<AuditRow[]> {
  try {
    const staff = await staffForAction();
    staff.require(area, 'view');
    return await listAudit({ item, limit: 20 });
  } catch {
    return [];
  }
}

/** "View as": an admin previews the menu and screens through a teammate's role. UI only; the server still enforces the real role. */
export async function setViewAs(userId: string | null): Promise<{ ok: boolean }> {
  const staff = await staffForAction();
  const jar = await cookies();
  if (!userId || !staff.isAdmin) { jar.delete(VIEW_AS_COOKIE); return { ok: true }; }
  jar.set(VIEW_AS_COOKIE, userId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/admin', maxAge: 60 * 60 * 8 });
  return { ok: true };
}
