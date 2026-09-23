// app/api/admin/summit-stream
//   GET   settings + counts (confirmed virtual attendees, how many already sent)
//   POST  { action: 'save', enabled, videoId }   save stream settings
//         { action: 'send_all' }                  email the watch-page link to
//                                                  every confirmed virtual attendee
//         { action: 'send_one', id }               (re)send to one registration
//         { action: 'send_custom', email, fullName? }  send the same email to any
//                                                       address (their own inbox, a
//                                                       guest, a test) - never touches
//                                                       registration data or tracking
//         { action: 'send_event_day', force? }     run the morning-of reminder now
//                                                   (force bypasses the "is it actually
//                                                   the Summit day" check, for testing)
// Admin only. All writes through the service role.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendStreamAccessEmail } from '@/lib/summitEmails';
import { sendEventDayEmails } from '@/lib/summitEventDay';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return false;
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

const forbidden = () => NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;

// A YouTube URL/ID pasted by the admin, in whatever form they copied it,
// normalised down to the bare 11-character video id, or null if unparseable.
function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|live|shorts)\/([\w-]{11})/);
    if (m) return m[2];
  } catch { /* not a URL */ }
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden();

  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['summit_stream_enabled', 'summit_stream_video_id']);
  const get = (k: string) => settings?.find(s => s.key === k)?.value ?? '';

  // Every paid attendee, onsite included, so the admin sees the full paid
  // list here. Only virtual ones are ever sent the stream link.
  const { data: paid } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, full_name, email, attendance_type, stream_access_sent_at')
    .eq('payment_status', 'paid')
    .order('full_name', { ascending: true });
  const virtual = (paid ?? []).filter(r => r.attendance_type === 'virtual');

  return NextResponse.json({
    enabled: get('summit_stream_enabled') === 'true',
    videoId: get('summit_stream_video_id') || '',
    attendees: paid ?? [],
    sentCount: virtual.filter(r => r.stream_access_sent_at).length,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden();

  const body = await req.json().catch(() => null);

  if (body?.action === 'save') {
    const enabled = body.enabled === true;
    const rawVideoId = typeof body.videoId === 'string' ? body.videoId : '';
    const videoId = rawVideoId.trim() ? parseYouTubeId(rawVideoId) : '';
    if (rawVideoId.trim() && videoId === null) {
      return NextResponse.json({ error: "Couldn't recognise that as a YouTube video link or id. Paste the full video URL, or leave it blank to auto-show whatever is live on the channel." }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin.from('platform_settings').upsert([
      { key: 'summit_stream_enabled', value: String(enabled), updated_at: nowIso },
      { key: 'summit_stream_video_id', value: videoId ?? '', updated_at: nowIso },
    ]);
    if (error) return NextResponse.json({ error: 'Save failed: ' + error.message }, { status: 500 });
    return NextResponse.json({ ok: true, videoId: videoId ?? '' });
  }

  if (body?.action === 'send_all' || body?.action === 'send_one') {
    let query = supabaseAdmin
      .from('summit_registrations')
      .select('id, full_name, email')
      .eq('payment_status', 'paid')
      .eq('attendance_type', 'virtual');
    if (body.action === 'send_one') {
      if (typeof body.id !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      query = query.eq('id', body.id);
    }
    const { data: targets, error } = await query;
    if (error) return NextResponse.json({ error: 'Could not load attendees' }, { status: 500 });
    if (!targets?.length) return NextResponse.json({ error: 'No confirmed virtual attendee matches that.' }, { status: 404 });

    let sent = 0, failed = 0;
    const failedNames: string[] = [];
    await Promise.allSettled(targets.map(async (r) => {
      try {
        await sendStreamAccessEmail(r.email, r.full_name);
        await supabaseAdmin.from('summit_registrations')
          .update({ stream_access_sent_at: new Date().toISOString() })
          .eq('id', r.id);
        sent++;
      } catch (err) {
        failed++;
        failedNames.push(r.full_name);
        console.error('[admin/summit-stream] send failed for', r.email, err);
      }
    }));

    return NextResponse.json({
      ok: sent > 0,
      sent, failed,
      message: failed > 0
        ? `Sent to ${sent}, failed for ${failed} (${failedNames.join(', ')}). Check SMTP settings and try again for those.`
        : `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}.`,
    }, { status: sent > 0 ? 200 : 502 });
  }

  // Send the exact same watch-page email to any address: the admin's own
  // inbox for a preview, a guest, or a manual re-send that does not belong to
  // a registration. Deliberately does not touch summit_registrations at all.
  if (body?.action === 'send_custom') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim() : 'there';
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    try {
      await sendStreamAccessEmail(email, fullName);
      return NextResponse.json({ ok: true, message: `Sent to ${email}.` });
    } catch (err) {
      console.error('[admin/summit-stream] send_custom failed:', err);
      return NextResponse.json({ error: 'Email failed to send. Check SMTP settings.' }, { status: 502 });
    }
  }

  // Manually run the morning-of-event reminder (virtual -> link, physical ->
  // no link). force bypasses the "is it actually the Summit day" check, so it
  // can be tested any day; the daily cron never passes force.
  if (body?.action === 'send_event_day') {
    try {
      const summary = await sendEventDayEmails({ force: body.force === true });
      if (!summary.ran) {
        return NextResponse.json({ ok: true, ...summary, message: "Today is not the Summit day, so nothing was sent. Use the force option to test it early." });
      }
      return NextResponse.json({
        ok: true, ...summary,
        message: `Sent to ${summary.sentVirtual} virtual and ${summary.sentPhysical} physical attendee${summary.sentVirtual + summary.sentPhysical === 1 ? '' : 's'}${summary.failed ? `, ${summary.failed} failed` : ''}.`,
      });
    } catch (err) {
      console.error('[admin/summit-stream] send_event_day failed:', err);
      return NextResponse.json({ error: 'Event-day send failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
