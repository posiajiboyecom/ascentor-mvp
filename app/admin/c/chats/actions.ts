'use server';

// Conversations: every open and every export is checked on the server (view to read, full to export) and written to the audit log
// with the teammate's name.

import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { buildExport, listTab, openConversation, type OpenedConvo, type TabList } from '@/lib/admin/conversations';
import { FORMATS, RANGES, TABS, type ExportRequest, type ScopeKind, type TabKey } from '@/lib/admin/conversations-meta';
import { logAccess, type ChatScope } from '@/lib/rx/chats';

const SCOPES: ScopeKind[] = ['one', 'members', 'tab', 'everything', 'sage', 'dm', 'circlegroup', 'posts', 'agenda'];
const isTab = (t: unknown): t is TabKey => TABS.some((x) => x.key === t);
const tabLabel = (t: TabKey) => TABS.find((x) => x.key === t)!.label;
const okId = (id: unknown): id is string => typeof id === 'string' && (/^(cs:)?[0-9a-f-]{36}$/i.test(id) || /^ch:[a-z0-9_-]{1,64}$/i.test(id));
const LOGGED = ['sage', 'dm', 'circle', 'group', 'member', 'calls', 'channels', 'removed'];
const refOf = (id: string) => (/^[0-9a-f-]{36}$/i.test(id) ? id : null);
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');

export async function loadTabAction(tab: TabKey): Promise<{ ok: true; list: TabList } | { ok: false; error: string }> {
  try {
    const staff = await staffForAction();
    staff.require('chats', 'view');
    if (!isTab(tab)) return { ok: false, error: 'Unknown tab.' };
    return { ok: true, list: await listTab(tab) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function openConversationAction(tab: TabKey, id: string, name: string): Promise<{ ok: true; conv: OpenedConvo } | { ok: false; error: string }> {
  try {
    const staff = await staffForAction();
    staff.require('chats', 'view');
    if (!isTab(tab) || !okId(id)) return { ok: false, error: 'That conversation is no longer available.' };
    const conv = await openConversation(tab, id, String(name ?? '').slice(0, 200));
    if (!conv) return { ok: false, error: 'That conversation is no longer available.' };
    await auditAdmin(staff, 'Read', conv.name, tabLabel(tab));
    if (LOGGED.includes(tab)) await logAccess(staff.userId, 'view', tab as ChatScope, refOf(id), undefined, id.startsWith('ch:') ? { channel: id.slice(3) } : {});
    return { ok: true, conv };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export interface ExportDone { ok: true; filename: string; mime: string; base64: string; messages: number; capped: boolean }

export async function exportAction(req: ExportRequest): Promise<ExportDone | { ok: false; error: string }> {
  try {
    const staff = await staffForAction();
    staff.require('chats', 'full');
    const r: ExportRequest = {
      scope: req?.scope, tab: req?.tab, id: req?.id,
      title: String(req?.title ?? 'export').slice(0, 200), scopeLabel: String(req?.scopeLabel ?? '').slice(0, 200),
      format: req?.format, range: req?.range, attach: !!req?.attach, meta: !!req?.meta, anon: !!req?.anon,
    };
    if (!SCOPES.includes(r.scope) || !(FORMATS as readonly string[]).includes(r.format) || !(RANGES as readonly string[]).includes(r.range)) return { ok: false, error: 'Choose a format, what to include and a time range.' };
    if (r.tab !== undefined && !isTab(r.tab)) return { ok: false, error: 'Unknown tab.' };
    if ((r.scope === 'one' || r.scope === 'members') && (!r.tab || !okId(r.id))) return { ok: false, error: 'Open a conversation first.' };
    if (r.scope === 'tab' && !r.tab) return { ok: false, error: 'Unknown tab.' };

    const built = await buildExport(r, staff.name);
    await auditAdmin(staff, `Exported (${r.format}${r.anon ? ', names hidden' : ''}${built.capped ? ', capped at 20,000 messages' : ''})`, `${r.title} · ${r.scopeLabel} · ${r.range}`, 'Exports');
    if (r.tab && LOGGED.includes(r.tab)) await logAccess(staff.userId, 'export', r.tab as ChatScope, r.scope === 'one' && r.id ? refOf(r.id) : null, r.format, { messages: built.messages, scope: r.scope });
    return { ok: true, filename: built.filename, mime: built.mime, base64: built.data.toString('base64'), messages: built.messages, capped: built.capped };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
