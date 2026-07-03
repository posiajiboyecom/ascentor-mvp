// app/api/summit/register/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/summit/register
// Public endpoint — no auth required (marketing page, pre-login).
// Inserts into summit_registrations and sends a branded confirmation email.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function confirmationHtml(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0];
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
            We have your details. You are now on the list for the inaugural Elevation Summit —
            one day in Lagos, February 2027, that exists for one purpose: to send you back
            to your life more built than you arrived.
          </p>
        </td></tr>

        <tr><td style="padding:0 36px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1E1D1B;border-radius:10px;border:1px solid rgba(200,169,110,0.15);">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">What happens next</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ['📩', 'A confirmation has been recorded — this email is your receipt.'],
                  ['📱', 'We will reach you on WhatsApp for logistics and updates closer to the event.'],
                  ['🗓', 'Full agenda, location details, and speaker announcements will be sent by email.'],
                ].map(([icon, text]) => `
                <tr>
                  <td style="width:28px;vertical-align:top;padding:5px 10px 5px 0;font-size:16px;">${icon}</td>
                  <td style="font-size:13px;color:#9CA3AF;line-height:1.6;padding:5px 0;">${text}</td>
                </tr>`).join('')}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 36px 32px;">
          <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.7;font-style:italic;">
            "Every gathering has one purpose: to send people back to their lives more built than they arrived."
          </p>
          <a href="https://ascentorbi.com/experts" style="display:inline-block;padding:12px 22px;background:#C8A96E;color:#0F0F0E;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;">
            Explore Ascentor while you wait →
          </a>
        </td></tr>

        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#4B5563;font-family:'Courier New',monospace;letter-spacing:0.04em;">
            YOU REGISTERED FOR THE ELEVATION SUMMIT 2027 · LAGOS, NIGERIA<br>
            <a href="https://ascentorbi.com" style="color:#6B7280;text-decoration:none;">ascentorbi.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Required fields
  const { full_name, email, whatsapp, country } = body;
  if (!full_name || typeof full_name !== 'string' || !full_name.trim())
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  if (!email || typeof email !== 'string' || !email.includes('@'))
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  if (!whatsapp || typeof whatsapp !== 'string' || !whatsapp.trim())
    return NextResponse.json({ error: 'WhatsApp number is required.' }, { status: 400 });
  if (!country || typeof country !== 'string' || !country.trim())
    return NextResponse.json({ error: 'Country is required.' }, { status: 400 });

  // Insert registration
  const { error: dbError } = await supabaseAdmin
    .from('summit_registrations')
    .insert({
      full_name:     (full_name as string).trim(),
      email:         (email as string).trim().toLowerCase(),
      whatsapp:      (whatsapp as string).trim(),
      phone:         body.phone || null,
      country:       (country as string).trim(),
      city:          body.city || null,
      current_role:  body.current_role || null,
      organisation:  body.organisation || null,
      industry:      body.industry || null,
      what_building: body.what_building || null,
      why_attend:    body.why_attend || null,
      how_heard:     body.how_heard || null,
      dietary_needs: body.dietary_needs || null,
      accessibility: body.accessibility || null,
      status:        'pending',
    });

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json(
        { error: "You've already registered. We'll be in touch — see you at the Summit." },
        { status: 409 }
      );
    }
    console.error('[summit/register] DB error:', dbError.message);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  // Send confirmation email (non-fatal)
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from:    'Ascentor <notifications@ascentorbi.com>',
          to:      (email as string).trim().toLowerCase(),
          subject: 'You\'re registered — The Elevation Summit 2027',
          html:    confirmationHtml((full_name as string).trim()),
        }),
      });
    }
  } catch (err: any) {
    console.warn('[summit/register] email non-fatal:', err.message);
  }

  return NextResponse.json({ ok: true });
}
