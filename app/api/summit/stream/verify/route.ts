// POST /api/summit/stream/verify
// Public. The Elevation Summit livestream gate: given an email, tells the
// caller whether that email belongs to a PAID Summit registration, and if so
// what to embed. Never reveals anything about an email beyond "found / not
// found / not paid" - no other registration fields are ever returned.
//
// The programme has not started ("eventStarted" is server-clock based, from
// SUMMIT_START_INSTANT): nothing about the stream (enabled flag, video id,
// channel id) is ever included in the response, so it cannot be discovered by
// inspecting the API before the event actually begins.
//
// Body: { email: string }
// Response (200 in every case except rate-limit/bad-input; the UI reads `state`):
//   { state: 'not_found' }
//   { state: 'not_paid', fullName }
//   { state: 'paid', fullName, eventStarted: false, startsAt }
//   { state: 'paid', fullName, eventStarted: true, streamEnabled, videoId, channelId, channelUrl }
//
// GET (no body) re-checks the convenience cookie set by a prior POST, so a
// page refresh does not force the visitor to retype their email. It is not a
// security boundary: the server re-validates that exact email against the
// database on every call, so a forged/stale cookie can never grant more than
// that specific email already legitimately has.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { summitStreamLimiter, getClientIp } from '@/lib/rate-limit';
import { SUMMIT_START_INSTANT, hasSummitStarted } from '@/lib/elevationSummit';

// AscentorBI - resolved once from https://www.youtube.com/@AscentorGlobal.
// Used so the page can auto-embed whatever is currently live on the channel
// when the admin has not pasted a specific video id. NOTE: this only works if
// that live stream's own visibility is Public. A Private stream cannot be
// embedded for anyone but the channel owner's account; an Unlisted stream can
// be embedded and played by anyone with the link while staying out of search -
// that is the setting to use for a paid, gated event. See the admin page.
export const SUMMIT_CHANNEL_ID = 'UCK2ixTgohGdFcfGTDoxYCWQ';
export const SUMMIT_CHANNEL_URL = 'https://www.youtube.com/@AscentorGlobal';

type LookupResult =
  | { state: 'not_found' }
  | { state: 'not_paid'; fullName: string }
  | { state: 'paid'; fullName: string; eventStarted: false; startsAt: string }
  | { state: 'paid'; fullName: string; eventStarted: true; streamEnabled: boolean; videoId: string | null; channelId: string; channelUrl: string };

async function lookupEmail(email: string): Promise<LookupResult> {
  const { data: reg } = await supabaseAdmin
    .from('summit_registrations')
    .select('full_name, payment_status')
    .eq('email', email)
    .maybeSingle();

  if (!reg) return { state: 'not_found' };
  if (reg.payment_status !== 'paid') return { state: 'not_paid', fullName: reg.full_name };

  if (!hasSummitStarted()) {
    return { state: 'paid', fullName: reg.full_name, eventStarted: false, startsAt: SUMMIT_START_INSTANT.toISOString() };
  }

  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['summit_stream_enabled', 'summit_stream_video_id']);
  const get = (k: string) => settings?.find(s => s.key === k)?.value ?? '';

  return {
    state: 'paid',
    fullName: reg.full_name,
    eventStarted: true,
    streamEnabled: get('summit_stream_enabled') === 'true',
    videoId: get('summit_stream_video_id') || null,
    channelId: SUMMIT_CHANNEL_ID,
    channelUrl: SUMMIT_CHANNEL_URL,
  };
}

function withConvenienceCookie(res: NextResponse, email: string): NextResponse {
  res.cookies.set('summit_stream_email', email, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 18,
  });
  return res;
}

export async function POST(req: NextRequest) {
  const limit = summitStreamLimiter.check(getClientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  let body: { email?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    const result = await lookupEmail(email);
    return withConvenienceCookie(NextResponse.json(result), email);
  } catch (err) {
    console.error('[summit/stream/verify] error:', err);
    return NextResponse.json({ error: 'Could not check that email right now. Please try again.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const email = req.cookies.get('summit_stream_email')?.value;
  if (!email) return NextResponse.json({ state: 'anonymous' });

  const limit = summitStreamLimiter.check(getClientIp(req));
  if (!limit.allowed) return NextResponse.json({ state: 'anonymous' }); // fail open to the manual form, never block silently

  try {
    const result = await lookupEmail(email);
    return withConvenienceCookie(NextResponse.json(result), email);
  } catch (err) {
    console.error('[summit/stream/verify] GET error:', err);
    return NextResponse.json({ state: 'anonymous' });
  }
}
