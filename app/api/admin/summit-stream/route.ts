// app/api/admin/summit-stream
//   GET   settings + counts (confirmed virtual attendees, how many already sent)
//   POST  { action: 'save', enabled, videoId }        save stream settings
//         { action: 'send_all' }                       email the watch-page link
//                                                        to every confirmed virtual attendee
//         { action: 'send_one', id }                    (re)send to one registration
// Admin only. All writes through the service role.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendStreamAccessEmail } from '@/lib/summitEmails';

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

// A YouTube URL/ID pasted by the admin, in whatever form they copied it -
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

  const { data: virtual } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, full_name, email, stream_access_sent_at')
    .eq('payment_status', 'paid')
    .eq('attendance_type', 'virtual')
    .order('full_name', { ascending: true });

  return NextResponse.json({
    enabled: get('summit_stream_enabled') === 'true',
    videoId: get('summit_stream_video_id') || '',
    attendees: virtual ?? [],
    sentCount: (virtual ?? []).filter(r => r.stream_access_sent_at).length,
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

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
