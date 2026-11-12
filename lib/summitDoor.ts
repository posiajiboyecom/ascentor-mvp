// lib/summitDoor.ts
// Server-only. Volunteer access to the Summit entrance check-in at /door, for people without an Ascentor admin account.
//
// An admin switches it on in Entrance check-in and shares the link and a door code. A volunteer types their name and
// the code and gets a signed cookie that lets them scan tickets and nothing else. "New code" bumps the version, which
// signs out every volunteer at once; "Turn off" stops all volunteer access immediately. Sessions also end on their own
// after 18 hours.

import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

const COOKIE = 'summit_door';
const SESSION_MS = 18 * 60 * 60 * 1000;
// No 0/O, 1/I/L: the code is read out loud and typed on a phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface DoorAccess { enabled: boolean; code: string; version: number; updatedAt: string | null }
export interface DoorSession { name: string; version: number; expires: number }

function secret(): Buffer {
  const base = process.env.DOOR_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('Door access is not configured on the server.');
  return crypto.createHash('sha256').update(`summit-door-session:${base}`).digest();
}

function newCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export async function getDoorAccess(): Promise<DoorAccess> {
  const { data } = await supabaseAdmin.from('summit_door_access').select('enabled, code, version, updated_at').eq('id', 1).maybeSingle();
  if (!data) return { enabled: false, code: '', version: 0, updatedAt: null };
  return { enabled: !!data.enabled, code: data.code as string, version: data.version as number, updatedAt: data.updated_at as string };
}

/** Turn volunteer access on or off. Turning it on for the first time, or asking for a new code, makes a new code. */
export async function setDoorAccess(opts: { enabled: boolean; newCode?: boolean }, staffId: string): Promise<DoorAccess> {
  const cur = await getDoorAccess();
  const fresh = opts.newCode || !cur.code;
  const row = {
    id: 1,
    enabled: opts.enabled,
    code: fresh ? newCode() : cur.code,
    version: fresh ? cur.version + 1 : cur.version,
    updated_at: new Date().toISOString(),
    updated_by: staffId,
  };
  const { error } = await supabaseAdmin.from('summit_door_access').upsert(row, { onConflict: 'id' });
  if (error) throw new Error('We could not save that. Please try again.');
  return { enabled: row.enabled, code: row.code, version: row.version, updatedAt: row.updated_at };
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(s: DoorSession): string {
  const payload = Buffer.from(JSON.stringify({ n: s.name, v: s.version, e: s.expires })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): DoorSession | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { n?: unknown; v?: unknown; e?: unknown };
    if (typeof o.n !== 'string' || typeof o.v !== 'number' || typeof o.e !== 'number') return null;
    return { name: o.n, version: o.v, expires: o.e };
  } catch { return null; }
}

function codesMatch(a: string, b: string): boolean {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

/** Check a volunteer's name and code; on success, set their session cookie. Returns an error message, or null. */
export async function startDoorSession(name: string, code: string): Promise<string | null> {
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (cleanName.length < 2) return 'Enter your name.';
  const access = await getDoorAccess();
  if (!access.enabled || !access.code) return 'Volunteer access is switched off. Ask the Summit team to turn it on.';
  if (!codesMatch(code.replace(/\s+/g, '').toUpperCase(), access.code)) return 'That door code is not right.';
  const session: DoorSession = { name: cleanName, version: access.version, expires: Date.now() + SESSION_MS };
  (await cookies()).set(COOKIE, encode(session), { httpOnly: true, secure: true, sameSite: 'lax', path: '/door', maxAge: SESSION_MS / 1000 });
  return null;
}

export async function endDoorSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: '/door' });
}

/** The signed-in volunteer, or null when there is none, it has expired, access is off or the code has changed. */
export async function getDoorSession(): Promise<DoorSession | null> {
  const s = decode((await cookies()).get(COOKIE)?.value);
  if (!s || s.expires < Date.now()) return null;
  const access = await getDoorAccess();
  if (!access.enabled || access.version !== s.version) return null;
  return s;
}

/** Like getDoorSession, for server actions: throws when there is no valid volunteer session. */
export async function requireDoorSession(): Promise<DoorSession> {
  const s = await getDoorSession();
  if (!s) throw new Error('Your volunteer session has ended. Reload the page and enter the door code again.');
  return s;
}

/** "a***@gmail.com": enough for a volunteer to confirm it is the right person, without handing them the whole list. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email ? '***' : '';
  return `${user.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length >= 4 ? `***${d.slice(-4)}` : '';
}
