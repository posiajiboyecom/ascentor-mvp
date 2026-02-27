import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// ── Clients (initialised once at module level) ─────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

// ── Email HTML builder ─────────────────────────────────────
function buildConfirmationEmailHtml({
  name,
  position,
  token,
  refCode,
}: {
  name: string;
  position: number;
  token: string;
  refCode: string;
}): string {
  const confirmUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist/confirm?token=${token}`;
  const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist?ref=${refCode}`;
  const unsubUrl    = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist/unsubscribe?token=${token}`;
  const year        = new Date().getFullYear();

  const perks = [
    '24/7 AI Mentor — trained on African career context',
    "Live sessions with Africa's top professionals",
    'Peer mentorship circles matched to your life stage',
    'Career tools from student to executive level',
  ];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>You're on the Ascentor waitlist</title>
    </head>
    <body style="margin:0;padding:0;background:#FAFAF9;font-family:'DM Sans',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E5E4;max-width:560px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:#0A0E17;padding:32px 40px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#F59E0B;font-family:Georgia,serif;">
                    ⬆ Ascentor
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 32px;">
                  <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0A0E17;font-family:Georgia,serif;line-height:1.2;">
                    You're in, ${name}. 🎉
                  </h1>
                  <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.7;">
                    Welcome to the Ascentor waitlist. You're position
                    <strong style="color:#0A0E17;">#${position}</strong> in line.
                    Early members get <strong style="color:#F59E0B;">3 months free</strong> on launch.
                  </p>

                  <!-- Position card -->
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#0A0E17;border-radius:12px;margin-bottom:28px;">
                    <tr>
                      <td style="padding:24px 28px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;">
                          YOUR WAITLIST POSITION
                        </p>
                        <p style="margin:0 0 4px;font-size:48px;font-weight:700;color:#F59E0B;font-family:Georgia,serif;line-height:1;">
                          #${position}
                        </p>
                        <p style="margin:0;font-size:12px;color:#6B7280;">
                          3 months free on any plan · No credit card needed
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Confirm CTA -->
                  <p style="margin:0 0 16px;font-size:14px;color:#6B7280;line-height:1.6;">
                    Confirm your email to fully secure your spot:
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#F59E0B;border-radius:10px;">
                        <a href="${confirmUrl}"
                          style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#000000;text-decoration:none;">
                          Confirm My Email →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Referral nudge -->
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#FFF9EB;border-radius:12px;border:1px solid rgba(245,158,11,0.25);margin-bottom:28px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#B45309;">
                          🚀 Move up the list faster
                        </p>
                        <p style="margin:0 0 12px;font-size:13px;color:#92400E;line-height:1.6;">
                          Every friend you refer moves you up. Share your personal link:
                        </p>
                        <p style="margin:0;font-size:12px;color:#B45309;font-family:monospace;word-break:break-all;">
                          ${referralUrl}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- What is coming -->
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0A0E17;">
                    What you're getting access to:
                  </p>
                  ${perks.map(item => `
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;width:100%;">
                    <tr>
                      <td style="width:20px;vertical-align:top;padding-top:1px;">
                        <span style="color:#F59E0B;font-size:13px;">✓</span>
                      </td>
                      <td style="font-size:13px;color:#374151;line-height:1.5;">${item}</td>
                    </tr>
                  </table>`).join('')}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;border-top:1px solid #E5E5E4;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.8;">
                    © ${year} Ascentor Inc. ·
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/terms" style="color:#9CA3AF;text-decoration:none;">Terms</a>
                    ·
                    <a href="${unsubUrl}" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ── POST /api/waitlist ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;

    const userAgent = request.headers.get('user-agent') ?? null;

    // Call the Supabase stored function (handles duplicate detection)
    const { data, error } = await supabase.rpc('submit_waitlist_entry', {
      p_first_name:      body.first_name,
      p_last_name:       body.last_name,
      p_email:           body.email,
      p_whatsapp:        body.whatsapp        ?? null,
      p_life_stage:      body.life_stage      ?? 'builder',
      p_country:         body.country         ?? null,
      p_industry:        body.industry        ?? null,
      p_referral_source: body.referral_source ?? null,
      p_utm_source:      body.utm_source      ?? null,
      p_utm_medium:      body.utm_medium      ?? null,
      p_utm_campaign:    body.utm_campaign    ?? null,
      p_referred_by:     body.referred_by     ?? null,
      p_ip_address:      ip,
      p_user_agent:      userAgent,
      p_landing_page:    body.landing_page    ?? null,
      p_consent:         body.consent         ?? false,
    });

    if (error) {
      console.error('[waitlist] Supabase RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to save. Please try again.' },
        { status: 500 }
      );
    }

    // Duplicate email — return 409 with their existing position
    if (data?.status === 'duplicate') {
      return NextResponse.json(
        { message: "You're already on the waitlist!", position: data.position },
        { status: 409 }
      );
    }

    // Send confirmation email — non-blocking (failure does not break the response)
    const { error: emailError } = await resend.emails.send({
      from:    'Ascentor <hello@ascentor.co>',
      to:      body.email,
      subject: `You're on the Ascentor waitlist — position #${data.position} 🎉`,
      html:    buildConfirmationEmailHtml({
        name:     body.first_name,
        position: data.position,
        token:    data.confirmation_token,
        refCode:  data.referral_code,
      }),
    });

    if (emailError) {
      // User is already saved — log only, do not fail the request
      console.error('[waitlist] Resend error:', emailError);
    }

    return NextResponse.json(
      {
        message:       'Welcome to the waitlist!',
        position:      data.position,
        referral_code: data.referral_code,
      },
      { status: 201 }
    );

  } catch (err) {
    console.error('[waitlist] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// ── GET /api/waitlist — returns current total count ────────
export async function GET() {
  try {
    const { count, error } = await supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('gdpr_delete_requested', false);

    if (error) throw error;

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[waitlist] GET error:', err);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
