import 'server-only';
// lib/rx/calls.ts
// Audio-only calls on Daily. One CallProvider module (createRoom, createToken, deleteRoom) so the provider can change
// without touching Circle logic. Calls are audio only: camera and screen sharing are blocked at the room and on every
// token. Nothing is recorded. Only attendance minutes are stored (never content).
//
// Needs DAILY_API_KEY. Without it every call shows the "call unavailable" state and members continue in the chat.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { nextWeekdayAt } from './dates';

const API = 'https://api.daily.co/v1';

export const CIRCLE_CALL_MINUTES = 15;
export const MENTOR_CALL_MINUTES = 20;
export const OPENS_EARLY_MINUTES = 5;
export const MAX_PARTICIPANTS = 12;
export const MONTHLY_FREE_MINUTES = 10000;

export const callsConfigured = () => !!process.env.DAILY_API_KEY;

async function daily(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}`, ...(init.headers ?? {}) }, cache: 'no-store' });
}

export interface RoomInfo { name: string; url: string }

/** Finds or creates the private audio-only room with this name. */
export async function ensureRoom(name: string): Promise<RoomInfo> {
  const got = await daily(`/rooms/${encodeURIComponent(name)}`);
  if (got.ok) { const j = (await got.json()) as RoomInfo; return { name: j.name, url: j.url }; }

  const base = { name, privacy: 'private' as const };
  const strict = { ...base, properties: { max_participants: MAX_PARTICIPANTS, enable_screenshare: false, start_video_off: true, enable_chat: false, enable_prejoin_ui: false, permissions: { canSend: ['audio'] } } };
  let res = await daily('/rooms', { method: 'POST', body: JSON.stringify(strict) });
  if (!res.ok) {
    // If the account rejects the room-level permission block, fall back to the safe subset. The token still limits sending to audio.
    console.warn('[calls] strict room create failed, retrying without permissions:', res.status);
    const lean = { ...base, properties: { max_participants: MAX_PARTICIPANTS, enable_screenshare: false, start_video_off: true, enable_chat: false, enable_prejoin_ui: false } };
    res = await daily('/rooms', { method: 'POST', body: JSON.stringify(lean) });
  }
  if (!res.ok) throw new Error(`Daily room create failed (${res.status})`);
  const j = (await res.json()) as RoomInfo;
  return { name: j.name, url: j.url };
}

export async function deleteRoom(name: string): Promise<void> {
  await daily(`/rooms/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => undefined);
}

export interface TokenOpts { room: string; userId: string; userName: string; isOwner: boolean; notBefore: Date; expires: Date }

export async function createToken(o: TokenOpts): Promise<string> {
  const body = {
    properties: {
      room_name: o.room, user_id: o.userId, user_name: o.userName, is_owner: o.isOwner,
      nbf: Math.floor(o.notBefore.getTime() / 1000), exp: Math.floor(o.expires.getTime() / 1000), eject_at_token_exp: true,
      enable_screenshare: false, start_video_off: true, start_audio_off: false,
      permissions: { canSend: ['audio'] },
    },
  };
  let res = await daily('/meeting-tokens', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const lean = { properties: { ...body.properties } as Record<string, unknown> };
    delete lean.properties.permissions;
    res = await daily('/meeting-tokens', { method: 'POST', body: JSON.stringify(lean) });
  }
  if (!res.ok) throw new Error(`Daily token create failed (${res.status})`);
  return ((await res.json()) as { token: string }).token;
}

// ── who may join what, and when ─────────────────────────────────────────────

export type CallKind = 'circle' | 'mentor';
export interface CallWindow {
  kind: CallKind;
  title: string;
  startsAt: Date;
  endsAt: Date;
  opensAt: Date;
  state: 'waiting' | 'open' | 'ended';
}

const stateAt = (now: Date, opensAt: Date, endsAt: Date): CallWindow['state'] => (now < opensAt ? 'waiting' : now < endsAt ? 'open' : 'ended');

/** The weekly Circle call: the occurrence running now, or the next one. */
export function circleWindow(c: { name: string; number: number; meeting_dow: number; meeting_time: string; timezone: string | null }, now: Date = new Date()): CallWindow {
  const startsAt = nextWeekdayAt(c.meeting_dow, c.meeting_time.slice(0, 5), c.timezone, new Date(now.getTime() - CIRCLE_CALL_MINUTES * 60000 - 1000));
  const endsAt = new Date(startsAt.getTime() + CIRCLE_CALL_MINUTES * 60000);
  const opensAt = new Date(startsAt.getTime() - OPENS_EARLY_MINUTES * 60000);
  return { kind: 'circle', title: `${c.name} · Circle ${c.number} weekly call`, startsAt, endsAt, opensAt, state: stateAt(now, opensAt, endsAt) };
}

export function mentorWindow(title: string, startsAtIso: string, durationMin: number, now: Date = new Date()): CallWindow {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
  const opensAt = new Date(startsAt.getTime() - OPENS_EARLY_MINUTES * 60000);
  return { kind: 'mentor', title, startsAt, endsAt, opensAt, state: stateAt(now, opensAt, endsAt) };
}

// ── attendance and the monthly budget ───────────────────────────────────────

export async function monthlyMinutes(): Promise<{ used: number; share: number }> {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin.from('call_attendance').select('minutes').gte('joined_at', start.toISOString()).not('minutes', 'is', null);
  const used = Math.round(((data ?? []) as { minutes: number }[]).reduce((n, r) => n + Number(r.minutes ?? 0), 0));
  return { used, share: used / MONTHLY_FREE_MINUTES };
}
