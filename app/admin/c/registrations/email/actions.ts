'use server';

// Custom email to Summit registrants. Needs Edit on Registrations, checked here and not in the page.
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { countAudience, sendCustomChunk, sendCustomTo, type Audience } from '@/lib/summitCustomEmail';

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');
const aud = (a: unknown): Audience => (a === 'physical' || a === 'virtual' ? a : 'all');
const clean = (subject: unknown, message: unknown) => {
  const s = String(subject ?? '').trim().slice(0, 200), m = String(message ?? '').trim().slice(0, 5000);
  if (!s) throw new Error('Add a subject.');
  if (!m) throw new Error('Write a message.');
  return { s, m };
};

export async function countAction(audience: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try { const staff = await staffForAction(); staff.require('registrations', 'edit'); return { ok: true, count: await countAudience(aud(audience)) }; }
  catch (e) { return { ok: false, error: msg(e) }; }
}

export async function sendTestAction(subject: string, message: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  try {
    const staff = await staffForAction(); staff.require('registrations', 'edit');
    const { s, m } = clean(subject, message);
    if (!staff.email) throw new Error('Your account has no email address.');
    await sendCustomTo(staff.email, staff.name, `[Test] ${s}`, m);
    return { ok: true, to: staff.email };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function sendChunkAction(audience: string, subject: string, message: string, cursor: number) {
  try {
    const staff = await staffForAction(); staff.require('registrations', 'edit');
    const { s, m } = clean(subject, message);
    const r = await sendCustomChunk(aud(audience), s, m, Math.max(0, Math.floor(Number(cursor) || 0)));
    if (r.done) await auditAdmin(staff, `Emailed Summit registrants (${aud(audience)}): ${s.slice(0, 80)}`, 'Summit email', 'Registrations');
    return { ok: true as const, ...r };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}
