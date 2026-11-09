'use server';
// Admin → Email. Every action checks the caller's level on the 'newsletter' area first:
//   view  read campaigns, contacts and numbers
//   edit  draft campaigns and templates, send yourself tests, add contacts, refresh contacts, unsubscribe/resubscribe
//   full  send and schedule campaigns, import and export contacts, change sending settings
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { can, type Level } from '@/lib/admin/areas';
import {
  EMPTY_STATS, SOURCES, audienceIsEmpty, describeAudience, dispatch, emailDb, getSettings, isEmail, kickDispatcher,
  parseAudience, parseSender, referralCodesFor, renderEmail, sendTest, sentLast24h, usesReferralLink, type Audience, type SenderKey, type Campaign, type DispatchResult, type Settings, type Stats,
} from '@/lib/email/system';

const AREA = 'newsletter';
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: unknown, fallback: string): { ok: false; error: string } => {
  const m = e instanceof Error ? e.message : '';
  return { ok: false, error: m && m.length < 200 && !/supabase|postgres|relation|column/i.test(m) ? m : fallback };
};

async function staffAt(need: Level) {
  const staff = await staffForAction();
  if (!can(staff.level(AREA), need)) throw new Error(need === 'full' ? 'Only teammates with full email access can do this.' : 'Your role can’t change email.');
  return staff;
}
const db = () => emailDb();
const now = () => new Date().toISOString();

// ── overview ────────────────────────────────────────────────────────────────
export interface CampaignRow { id: string; name: string; subject: string; status: Campaign['status']; audience: string; scheduled_at: string | null; started_at: string | null; finished_at: string | null; updated_at: string; stats: Stats }
export interface Overview {
  settings: Settings; sent24: number; contacts: number; reachable: number;
  sources: { key: string; label: string; help: string; total: number; reachable: number }[];
  tags: { tag: string; total: number }[];
  campaigns: CampaignRow[];
}

async function statsFor(ids: string[]): Promise<Map<string, Stats>> {
  const m = new Map<string, Stats>();
  if (!ids.length) return m;
  const { data } = await db().rpc('email_campaign_stats', { cids: ids });
  for (const r of (data ?? []) as (Stats & { campaign_id: string })[]) m.set(r.campaign_id, { ...r });
  return m;
}

export async function loadOverview(): Promise<R<{ overview: Overview }>> {
  try {
    await staffAt('view');
    const [settings, sent24, { data: src }, { data: tags }, { count: contacts }, { count: reachable }, { data: camps }] = await Promise.all([
      getSettings(), sentLast24h(),
      db().rpc('email_source_counts'), db().rpc('email_tag_counts'),
      db().from('email_contacts').select('email', { count: 'exact', head: true }),
      db().from('email_contacts').select('email', { count: 'exact', head: true }).is('unsubscribed_at', null).is('bounced_at', null),
      db().from('email_campaigns').select('id, name, subject, status, audience, scheduled_at, started_at, finished_at, updated_at').order('created_at', { ascending: false }).limit(100),
    ]);
    const counts = new Map(((src ?? []) as { source: string; total: number; reachable: number }[]).map((r) => [r.source, r]));
    const rows = (camps ?? []) as (Omit<CampaignRow, 'audience' | 'stats'> & { audience: unknown })[];
    const stats = await statsFor(rows.map((r) => r.id));
    return {
      ok: true,
      overview: {
        settings, sent24, contacts: contacts ?? 0, reachable: reachable ?? 0,
        sources: SOURCES.map((s) => ({ ...s, total: counts.get(s.key)?.total ?? 0, reachable: counts.get(s.key)?.reachable ?? 0 })),
        tags: ((tags ?? []) as { tag: string; total: number }[]),
        campaigns: rows.map((r) => ({ ...r, audience: describeAudience(parseAudience(r.audience)), stats: stats.get(r.id) ?? EMPTY_STATS })),
      },
    };
  } catch (e) { return fail(e, 'We couldn’t load email.'); }
}

export async function syncContacts(): Promise<R<{ total: number; added: number }>> {
  try {
    const staff = await staffAt('edit');
    const { data, error } = await db().rpc('email_sync_contacts');
    if (error) throw new Error('We couldn’t refresh contacts.');
    const r = (data ?? {}) as { total?: number; added?: number };
    await auditAdmin(staff, 'Refreshed email contacts', `${r.added ?? 0} new`, AREA);
    return { ok: true, total: r.total ?? 0, added: r.added ?? 0 };
  } catch (e) { return fail(e, 'We couldn’t refresh contacts.'); }
}

// ── contacts ────────────────────────────────────────────────────────────────
export interface ContactRow { email: string; name: string | null; phone: string | null; sources: string[]; tags: string[]; last_seen_at: string | null; unsubscribed_at: string | null; bounced_at: string | null }
export interface ContactQuery { q?: string; source?: string; tag?: string; status?: 'all' | 'reachable' | 'unsubscribed' | 'bounced'; page?: number }
const PAGE = 50;

function contactsQuery(f: ContactQuery, select: string, count = false) {
  let q = db().from('email_contacts').select(select, count ? { count: 'exact' } : undefined);
  const term = (f.q ?? '').trim().replace(/[%,()*]/g, ' ').slice(0, 80);
  if (term) q = q.or(`email.ilike.%${term}%,name.ilike.%${term}%,phone.ilike.%${term}%`);
  if (f.source) q = q.contains('sources', [f.source]);
  if (f.tag) q = q.contains('tags', [f.tag]);
  if (f.status === 'reachable') q = q.is('unsubscribed_at', null).is('bounced_at', null);
  if (f.status === 'unsubscribed') q = q.not('unsubscribed_at', 'is', null);
  if (f.status === 'bounced') q = q.not('bounced_at', 'is', null);
  return q;
}

export async function listContacts(f: ContactQuery): Promise<R<{ rows: ContactRow[]; total: number; pageSize: number }>> {
  try {
    await staffAt('view');
    const page = Math.max(0, Math.floor(f.page ?? 0));
    const { data, count, error } = await contactsQuery(f, 'email, name, phone, sources, tags, last_seen_at, unsubscribed_at, bounced_at', true)
      .order('last_seen_at', { ascending: false, nullsFirst: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error('We couldn’t load contacts.');
    return { ok: true, rows: (data ?? []) as unknown as ContactRow[], total: count ?? 0, pageSize: PAGE };
  } catch (e) { return fail(e, 'We couldn’t load contacts.'); }
}

export interface ContactDetail extends ContactRow { source_seen: Record<string, string>; first_seen_at: string | null; unsubscribe_source: string | null; bounce_reason: string | null; notes: string | null; history: { campaign: string; status: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null }[] }

export async function contactDetail(email: string): Promise<R<{ contact: ContactDetail }>> {
  try {
    await staffAt('view');
    const e = email.trim().toLowerCase();
    const { data: c } = await db().from('email_contacts').select('*').eq('email', e).maybeSingle();
    if (!c) throw new Error('That contact isn’t in the list.');
    const { data: sends } = await db().from('email_sends').select('status, sent_at, opened_at, clicked_at, campaign_id, email_campaigns(name)').eq('email', e).order('created_at', { ascending: false }).limit(30);
    const history = ((sends ?? []) as unknown as { status: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null; email_campaigns: { name: string } | null }[])
      .map((s) => ({ campaign: s.email_campaigns?.name ?? 'Campaign', status: s.status, sent_at: s.sent_at, opened_at: s.opened_at, clicked_at: s.clicked_at }));
    return { ok: true, contact: { ...(c as ContactDetail), history } };
  } catch (e) { return fail(e, 'We couldn’t open that contact.'); }
}

export async function setSubscribed(email: string, subscribed: boolean): Promise<R> {
  try {
    const staff = await staffAt('edit');
    const e = email.trim().toLowerCase();
    const patch = subscribed ? { unsubscribed_at: null, unsubscribe_source: null, resubscribed_at: now(), updated_at: now() } : { unsubscribed_at: now(), unsubscribe_source: 'admin', updated_at: now() };
    const { data: c } = await db().from('email_contacts').select('unsubscribe_source').eq('email', e).maybeSingle();
    if (subscribed && c?.unsubscribe_source === 'deletion_request') throw new Error('This person asked for their data to be deleted, so they can’t be resubscribed.');
    const { error } = await db().from('email_contacts').update(patch).eq('email', e);
    if (error) throw new Error('We couldn’t update that contact.');
    await auditAdmin(staff, subscribed ? 'Resubscribed email contact' : 'Unsubscribed email contact', e, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t update that contact.'); }
}

export async function addContact(input: { email: string; name?: string; phone?: string; tag?: string }): Promise<R> {
  try {
    const staff = await staffAt('edit');
    const e = (input.email ?? '').trim().toLowerCase();
    if (!isEmail(e)) throw new Error('Enter a valid email address.');
    const tag = (input.tag ?? '').trim().slice(0, 60);
    const { data: existing } = await db().from('email_contacts').select('sources, tags').eq('email', e).maybeSingle();
    const sources = Array.from(new Set([...(existing?.sources as string[] ?? []), 'manual']));
    const tags = Array.from(new Set([...(existing?.tags as string[] ?? []), ...(tag ? [tag] : [])]));
    const { error } = await db().from('email_contacts').upsert({
      email: e, name: input.name?.trim() || undefined, phone: input.phone?.trim() || undefined, sources, tags,
      first_seen_at: now(), last_seen_at: now(), updated_at: now(),
    }, { onConflict: 'email' });
    if (error) throw new Error('We couldn’t add that contact.');
    await auditAdmin(staff, 'Added email contact', e, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t add that contact.'); }
}

/** CSV with a header row containing "email" (and optionally "name", "phone"). Everyone imported gets the 'imported' category and the tag given. */
export async function importContacts(csv: string, tag: string): Promise<R<{ added: number; updated: number; skipped: number }>> {
  try {
    const staff = await staffAt('full');
    const lines = (csv ?? '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
    if (lines.length < 2) throw new Error('The file needs a header row and at least one contact.');
    if (lines.length > 20001) throw new Error('Import up to 20,000 contacts at a time.');
    const split = (l: string) => { const out: string[] = []; let cur = ''; let q = false; for (const ch of l) { if (ch === '"') q = !q; else if ((ch === ',' || ch === ';') && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
    const head = split(lines[0]).map((h) => h.toLowerCase());
    const iE = head.findIndex((h) => h.includes('email'));
    if (iE < 0) throw new Error('No “email” column in the header row.');
    const iN = head.findIndex((h) => h === 'name' || h.includes('full name') || h === 'full_name' || h === 'first name' || h === 'first_name');
    const iP = head.findIndex((h) => h.includes('phone') || h.includes('whatsapp'));
    const t = tag.trim().slice(0, 60);
    const parsed = new Map<string, { name: string | null; phone: string | null }>();
    let skipped = 0;
    for (const l of lines.slice(1)) {
      const cells = split(l);
      const e = (cells[iE] ?? '').toLowerCase();
      if (!isEmail(e)) { skipped++; continue; }
      parsed.set(e, { name: iN >= 0 ? cells[iN] || null : null, phone: iP >= 0 ? cells[iP] || null : null });
    }
    const emails = [...parsed.keys()];
    let added = 0; let updated = 0;
    for (let i = 0; i < emails.length; i += 500) {
      const chunk = emails.slice(i, i + 500);
      const { data: existing } = await db().from('email_contacts').select('email, sources, tags, name, phone').in('email', chunk);
      const ex = new Map(((existing ?? []) as { email: string; sources: string[]; tags: string[]; name: string | null; phone: string | null }[]).map((r) => [r.email, r]));
      const rows = chunk.map((e) => {
        const p = parsed.get(e)!; const old = ex.get(e);
        if (old) updated++; else added++;
        return {
          email: e, name: old?.name ?? p.name, phone: old?.phone ?? p.phone,
          sources: Array.from(new Set([...(old?.sources ?? []), 'imported'])),
          tags: Array.from(new Set([...(old?.tags ?? []), ...(t ? [t] : [])])),
          first_seen_at: now(), last_seen_at: now(), updated_at: now(),
        };
      });
      const { error } = await db().from('email_contacts').upsert(rows, { onConflict: 'email' });
      if (error) throw new Error('We couldn’t save the imported contacts.');
    }
    await auditAdmin(staff, 'Imported email contacts', `${added} new, ${updated} updated${t ? `, tag ${t}` : ''}`, AREA);
    return { ok: true, added, updated, skipped };
  } catch (e) { return fail(e, 'We couldn’t import that file.'); }
}

export async function exportContacts(f: ContactQuery): Promise<R<{ csv: string; count: number }>> {
  try {
    const staff = await staffAt('full');
    const rows: ContactRow[] = [];
    for (let page = 0; page < 100; page++) {
      const { data, error } = await contactsQuery(f, 'email, name, phone, sources, tags, last_seen_at, unsubscribed_at, bounced_at').order('email').range(page * 1000, page * 1000 + 999);
      if (error) throw new Error('We couldn’t export contacts.');
      rows.push(...((data ?? []) as unknown as ContactRow[]));
      if (!data || data.length < 1000) break;
    }
    const cell = (v: unknown) => { const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
    const csv = ['email,name,phone,categories,tags,last_seen,unsubscribed,bounced', ...rows.map((r) => [r.email, r.name, r.phone, r.sources, r.tags, r.last_seen_at, r.unsubscribed_at, r.bounced_at].map(cell).join(','))].join('\n');
    await auditAdmin(staff, 'Exported email contacts', `${rows.length} contacts`, AREA);
    return { ok: true, csv, count: rows.length };
  } catch (e) { return fail(e, 'We couldn’t export contacts.'); }
}

// ── campaigns ───────────────────────────────────────────────────────────────
export interface Draft { id?: string; name: string; subject: string; preheader: string; heading: string; body_html: string; audience: Audience; sender?: SenderKey }
export interface CampaignDetail { campaign: Campaign; stats: Stats; failures: { email: string; error: string | null }[]; capLeft: number; perDay: number }

export async function audienceCount(aud: unknown): Promise<R<{ count: number }>> {
  try {
    await staffAt('view');
    const a = parseAudience(aud);
    if (audienceIsEmpty(a)) return { ok: true, count: 0 };
    const { data } = await db().rpc('email_audience_count', { aud: a });
    return { ok: true, count: Number(data ?? 0) };
  } catch (e) { return fail(e, 'We couldn’t count that audience.'); }
}

function cleanDraft(d: Draft) {
  return {
    name: (d.name ?? '').trim().slice(0, 120) || 'Untitled',
    subject: (d.subject ?? '').trim().slice(0, 200),
    preheader: (d.preheader ?? '').trim().slice(0, 200),
    heading: (d.heading ?? '').trim().slice(0, 200),
    body_html: (d.body_html ?? '').slice(0, 300_000),
    audience: parseAudience(d.audience),
    sender: parseSender(d.sender),
  };
}

export async function saveCampaign(d: Draft): Promise<R<{ id: string }>> {
  try {
    const staff = await staffAt('edit');
    const row = cleanDraft(d);
    if (d.id) {
      const { data: cur } = await db().from('email_campaigns').select('status').eq('id', d.id).maybeSingle();
      if (!cur) throw new Error('That campaign no longer exists.');
      if (!['draft', 'scheduled'].includes(cur.status as string)) throw new Error('A campaign can’t be changed once it has started sending. Duplicate it to make a new version.');
      const { error } = await db().from('email_campaigns').update({ ...row, updated_at: now() }).eq('id', d.id);
      if (error) throw new Error('We couldn’t save the campaign.');
      return { ok: true, id: d.id };
    }
    const { data, error } = await db().from('email_campaigns').insert({ ...row, created_by: staff.userId }).select('id').single();
    if (error || !data) throw new Error('We couldn’t save the campaign.');
    await auditAdmin(staff, 'Created email campaign', row.name, AREA);
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t save the campaign.'); }
}

export async function getCampaign(id: string): Promise<R<{ detail: CampaignDetail }>> {
  try {
    await staffAt('view');
    const { data: c } = await db().from('email_campaigns').select('*').eq('id', id).maybeSingle();
    if (!c) throw new Error('That campaign no longer exists.');
    const [stats, { data: fails }, settings, sent24] = await Promise.all([
      statsFor([id]), db().from('email_sends').select('email, error').eq('campaign_id', id).eq('status', 'failed').limit(50), getSettings(), sentLast24h(),
    ]);
    return { ok: true, detail: { campaign: { ...(c as Campaign), audience: parseAudience(c.audience) }, stats: stats.get(id) ?? EMPTY_STATS, failures: (fails ?? []) as { email: string; error: string | null }[], capLeft: Math.max(0, settings.daily_limit - sent24), perDay: settings.daily_limit } };
  } catch (e) { return fail(e, 'We couldn’t open that campaign.'); }
}

export async function previewCampaign(d: Draft): Promise<R<{ html: string; subject: string }>> {
  try {
    const staff = await staffAt('view');
    const s = await getSettings();
    const c = cleanDraft(d);
    const me = staff.email ?? 'you@example.com';
    const code = usesReferralLink(c) ? (await referralCodesFor([me])).get(me.toLowerCase()) ?? 'PREVIEW1' : null;
    const m = renderEmail(c, { email: me, name: staff.name, token: null, reason: 'You are receiving this because you subscribed to our newsletter.', referralCode: code }, s);
    return { ok: true, html: m.html, subject: m.subject };
  } catch (e) { return fail(e, 'We couldn’t build the preview.'); }
}

export async function sendTestEmail(d: Draft, to: string): Promise<R<{ to: string }>> {
  try {
    const staff = await staffAt('edit');
    const addr = (to || staff.email || '').trim().toLowerCase();
    if (!isEmail(addr)) throw new Error('Enter an address for the test.');
    const c = cleanDraft(d);
    if (!c.subject) throw new Error('Add a subject first.');
    await sendTest(c, addr, staff.name);
    return { ok: true, to: addr };
  } catch (e) { return fail(e, 'We couldn’t send the test. Check the mailbox settings.'); }
}

async function readyToSend(id: string) {
  const { data: c } = await db().from('email_campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) throw new Error('That campaign no longer exists.');
  if (!['draft', 'scheduled'].includes(c.status as string)) throw new Error('This campaign has already started.');
  if (!(c.subject as string)?.trim()) throw new Error('Add a subject before sending.');
  if (!(c.body_html as string)?.replace(/<[^>]+>/g, '').trim()) throw new Error('Write the message before sending.');
  const a = parseAudience(c.audience);
  if (audienceIsEmpty(a)) throw new Error('Choose who this goes to.');
  return c;
}

export async function startCampaign(id: string): Promise<R<{ total: number }>> {
  try {
    const staff = await staffAt('full');
    const c = await readyToSend(id);
    await db().rpc('email_sync_contacts');
    const { data: total } = await db().rpc('email_enqueue', { cid: id });
    if (!total) throw new Error('Nobody in this audience can be emailed (they may all be unsubscribed).');
    const { error } = await db().from('email_campaigns').update({ status: 'sending', started_at: now(), scheduled_at: null, updated_at: now() }).eq('id', id).in('status', ['draft', 'scheduled']);
    if (error) throw new Error('We couldn’t start sending.');
    await auditAdmin(staff, 'Started email campaign', `${c.name} → ${total} recipients`, AREA);
    await kickDispatcher();
    revalidatePath('/admin/c/newsletter');
    return { ok: true, total: Number(total) };
  } catch (e) { return fail(e, 'We couldn’t start sending.'); }
}

export async function scheduleCampaign(id: string, whenIso: string): Promise<R> {
  try {
    const staff = await staffAt('full');
    const c = await readyToSend(id);
    const when = new Date(whenIso);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) throw new Error('Pick a time at least a minute from now.');
    const { error } = await db().from('email_campaigns').update({ status: 'scheduled', scheduled_at: when.toISOString(), updated_at: now() }).eq('id', id);
    if (error) throw new Error('We couldn’t schedule it.');
    await auditAdmin(staff, 'Scheduled email campaign', `${c.name} for ${when.toISOString()}`, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t schedule it.'); }
}

export async function setCampaignState(id: string, action: 'pause' | 'resume' | 'cancel' | 'unschedule' | 'retry'): Promise<R> {
  try {
    const staff = await staffAt('full');
    const { data: c } = await db().from('email_campaigns').select('name, status').eq('id', id).maybeSingle();
    if (!c) throw new Error('That campaign no longer exists.');
    const st = c.status as Campaign['status'];
    if (action === 'pause' && st === 'sending') await db().from('email_campaigns').update({ status: 'paused', updated_at: now() }).eq('id', id);
    else if (action === 'resume' && st === 'paused') { await db().from('email_campaigns').update({ status: 'sending', updated_at: now() }).eq('id', id); await kickDispatcher(); }
    else if (action === 'unschedule' && st === 'scheduled') await db().from('email_campaigns').update({ status: 'draft', scheduled_at: null, updated_at: now() }).eq('id', id);
    else if (action === 'cancel' && ['sending', 'paused', 'scheduled'].includes(st)) {
      await db().from('email_campaigns').update({ status: 'cancelled', finished_at: now(), updated_at: now() }).eq('id', id);
      await db().from('email_sends').update({ status: 'skipped', error: 'Campaign cancelled' }).eq('campaign_id', id).eq('status', 'queued');
    } else if (action === 'retry' && ['sent', 'sending', 'paused'].includes(st)) {
      await db().from('email_sends').update({ status: 'queued', error: null, claimed_at: null }).eq('campaign_id', id).eq('status', 'failed');
      await db().from('email_campaigns').update({ status: 'sending', finished_at: null, updated_at: now() }).eq('id', id);
      await kickDispatcher();
    } else throw new Error('That can’t be done to this campaign right now.');
    await auditAdmin(staff, `Email campaign: ${action}`, c.name as string, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t update the campaign.'); }
}

export async function duplicateCampaign(id: string): Promise<R<{ id: string }>> {
  try {
    const staff = await staffAt('edit');
    const { data: c } = await db().from('email_campaigns').select('name, subject, preheader, heading, body_html, audience, sender').eq('id', id).maybeSingle();
    if (!c) throw new Error('That campaign no longer exists.');
    const { data, error } = await db().from('email_campaigns').insert({ ...c, name: `${c.name} (copy)`.slice(0, 120), created_by: staff.userId }).select('id').single();
    if (error || !data) throw new Error('We couldn’t duplicate it.');
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t duplicate it.'); }
}

/**
 * A follow-up draft for the people a finished campaign reached but who have not opened it. Nothing is sent: it opens as a draft
 * so the subject can be changed first. Opens are an estimate (some mail apps hide them), so the draft says so.
 */
export async function resendToUnopened(id: string): Promise<R<{ id: string; count: number }>> {
  try {
    const staff = await staffAt('edit');
    const { data: c } = await db().from('email_campaigns').select('name, subject, preheader, heading, body_html, status, sender').eq('id', id).maybeSingle();
    if (!c) throw new Error('That campaign no longer exists.');
    const { data: rows } = await db().from('email_sends').select('email').eq('campaign_id', id).eq('status', 'sent').is('opened_at', null).is('unsubscribed_at', null).limit(2001);
    const emails = [...new Set(((rows ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()).filter(isEmail))];
    if (!emails.length) throw new Error('Everyone who received it has opened it.');
    if (emails.length > 2000) throw new Error('More than 2,000 people have not opened it. Create the follow-up from the audience instead.');
    const subject = /^(reminder|re):/i.test(c.subject as string) ? (c.subject as string) : `Reminder: ${c.subject}`;
    const { data, error } = await db().from('email_campaigns').insert({
      name: `${c.name} (not opened)`.slice(0, 120), subject: subject.slice(0, 200), preheader: c.preheader, heading: c.heading, body_html: c.body_html, sender: parseSender(c.sender),
      audience: { all: false, sources: [], tags: [], exclude: [], emails }, created_by: staff.userId,
    }).select('id').single();
    if (error || !data) throw new Error('We couldn’t create the follow-up.');
    await auditAdmin(staff, 'Drafted a follow-up to people who had not opened', `${c.name} → ${emails.length} people`, AREA);
    return { ok: true, id: data.id as string, count: emails.length };
  } catch (e) { return fail(e, 'We couldn’t create the follow-up.'); }
}

export async function deleteCampaign(id: string): Promise<R> {
  try {
    const staff = await staffAt('edit');
    const { data: c } = await db().from('email_campaigns').select('name, status').eq('id', id).maybeSingle();
    if (!c) return { ok: true };
    if (c.status !== 'draft') throw new Error('Only drafts can be deleted. Cancel a campaign instead.');
    await db().from('email_campaigns').delete().eq('id', id);
    await auditAdmin(staff, 'Deleted email draft', c.name as string, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t delete it.'); }
}

/** Sends the next messages now from this request (about 40 seconds' worth), for when you're watching a send. */
export async function sendNextBatch(): Promise<R<{ result: DispatchResult }>> {
  try {
    await staffAt('full');
    const result = await dispatch({ budgetMs: 40_000, owner: 'admin-console' });
    return { ok: true, result };
  } catch (e) { return fail(e, 'We couldn’t send the next batch.'); }
}

// ── templates ───────────────────────────────────────────────────────────────
export interface Template { id: string; name: string; subject: string; preheader: string; body_html: string; sender: SenderKey; updated_at: string }

export async function listTemplates(): Promise<R<{ templates: Template[] }>> {
  try {
    await staffAt('view');
    const { data } = await db().from('email_templates').select('id, name, subject, preheader, body_html, sender, updated_at').order('updated_at', { ascending: false });
    return { ok: true, templates: ((data ?? []) as Template[]).map((t) => ({ ...t, sender: parseSender(t.sender) })) };
  } catch (e) { return fail(e, 'We couldn’t load templates.'); }
}

export async function saveTemplate(t: { id?: string; name: string; subject: string; preheader: string; body_html: string; sender?: SenderKey }): Promise<R<{ id: string }>> {
  try {
    const staff = await staffAt('edit');
    const row = { name: (t.name ?? '').trim().slice(0, 120) || 'Untitled template', subject: (t.subject ?? '').slice(0, 200), preheader: (t.preheader ?? '').slice(0, 200), body_html: (t.body_html ?? '').slice(0, 300_000), sender: parseSender(t.sender), updated_at: now() };
    if (t.id) {
      const { error } = await db().from('email_templates').update(row).eq('id', t.id);
      if (error) throw new Error('We couldn’t save the template.');
      return { ok: true, id: t.id };
    }
    const { data, error } = await db().from('email_templates').insert({ ...row, created_by: staff.userId }).select('id').single();
    if (error || !data) throw new Error('We couldn’t save the template.');
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t save the template.'); }
}

export async function deleteTemplate(id: string): Promise<R> {
  try {
    await staffAt('edit');
    await db().from('email_templates').delete().eq('id', id);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t delete the template.'); }
}

// ── settings ────────────────────────────────────────────────────────────────
export async function saveEmailSettings(s: Settings): Promise<R> {
  try {
    const staff = await staffAt('full');
    const daily = Math.round(Number(s.daily_limit));
    const pace = Math.round(Number(s.per_minute));
    if (!(daily >= 1 && daily <= 50000)) throw new Error('Daily limit must be between 1 and 50,000.');
    if (!(pace >= 1 && pace <= 300)) throw new Error('Pace must be between 1 and 300 a minute.');
    const reply = (s.reply_to ?? '').trim();
    if (reply && !isEmail(reply)) throw new Error('Reply-to must be an email address.');
    const { error } = await db().from('email_settings').update({
      from_name: (s.from_name ?? '').replace(/["<>\r\n]/g, '').trim().slice(0, 60) || 'Ascentor', reply_to: reply || null,
      daily_limit: daily, per_minute: pace, footer_text: (s.footer_text ?? '').trim().slice(0, 200), updated_at: now(),
    }).eq('id', true);
    if (error) throw new Error('We couldn’t save settings.');
    await auditAdmin(staff, 'Changed email settings', `daily ${daily}, ${pace}/min`, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t save settings.'); }
}
