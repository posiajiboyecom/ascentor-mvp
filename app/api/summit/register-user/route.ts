// app/api/summit/register-user/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST  — one-click Elevation Summit registration for authenticated app users.
//         Pulls name/email from their profile so they don't have to fill a form.
//         Writes user_id + source='app' so the admin can distinguish these from
//         marketing-page walk-ins.
// DELETE — unregisters (removes the row).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Pull profile data so the admin row is fully populated ─────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, current_role, industry')
    .eq('id', user.id)
    .single();

  const fullName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'Ascentor User';
  const email    = profile?.email || user.email || '';

  // ── Idempotent insert (conflict on user_id means already registered) ───────
  const { error: dbError } = await supabaseAdmin
    .from('summit_registrations')
    .insert({
      user_id:      user.id,
      full_name:    fullName,
      email:        email.trim().toLowerCase(),
      whatsapp:     '',          // not collected here; admin can see via profile
      country:      '',          // ditto
      current_role: profile?.current_role || null,
      industry:     profile?.industry     || null,
      how_heard:    'Ascentor platform',
      source:       'app',       // distinguish from marketing-page registrants
      status:       'pending',
    });

  if (dbError) {
    // 23505 = unique_violation — already registered is fine
    if (dbError.code === '23505') {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }
    console.error('[summit/register-user] DB error:', dbError.message);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  // ── In-app notification (real-time toast via NotificationProvider) ─────────
  await supabaseAdmin.from('notifications').insert({
    user_id: user.id,
    type:    'expert',
    title:   "You're registered for The Elevation Summit!",
    message: 'February 2027 · Lagos, Nigeria. We\'ll be in touch closer to the event.',
    link:    '/elevation-summit',
    read:    false,
  });

  // ── Confirmation email (non-fatal) ─────────────────────────────────────────
  const firstName = fullName.split(/\s+/)[0];
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && email) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from:    'Ascentor <notifications@ascentorbi.com>',
        to:      email.trim().toLowerCase(),
        subject: "You're registered — The Elevation Summit 2027",
        html:    buildConfirmationEmail(firstName),
      }),
    }).catch((err) => console.warn('[summit/register-user] email non-fatal:', err?.message));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabaseAdmin
    .from('summit_registrations')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[summit/register-user] delete error:', error.message);
    return NextResponse.json({ error: 'Unregister failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function buildConfirmationEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F0E;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0E;padding:48px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#161614;border-radius:16px;overflow:hidden;border:1px solid rgba(200,169,110,0.2);">
        <tr><td style="padding:32px 36px 0;">
          <img src="https://ascentorbi.com/ascentor-color-for-dark-pages.svg" alt="Ascentor" height="26" style="display:block;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#C8A96E;">
            ◇ The Elevation Summit · February 2027
          </p>
          <h2 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#FAFAF8;line-height:1.25;font-family:Georgia,serif;">
            You're registered, ${firstName}.
          </h2>
          <p style="margin:0 0 28px;font-size:15px;color:#9CA3AF;line-height:1.75;">
            We have your details. You are on the list for the inaugural Elevation Summit —
            one day in Lagos, February 2027, designed to send you back to your life more built than you arrived.
          </p>
        </td></tr>
        <tr><td style="padding:0 36px 32px;">
          <a href="https://ascentorbi.com/experts" style="display:inline-block;padding:12px 22px;background:#C8A96E;color:#0F0F0E;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;">
            Explore Ascentor while you wait →
          </a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#4B5563;font-family:'Courier New',monospace;letter-spacing:0.04em;">
            YOU REGISTERED FOR THE ELEVATION SUMMIT 2027 · LAGOS, NIGERIA
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
