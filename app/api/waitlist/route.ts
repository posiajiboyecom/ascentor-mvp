import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from '@/lib/emailTemplate';

// ── Lazy clients (never executed at build/module-eval time) ─
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Email HTML builder ─────────────────────────────────────
function buildConfirmationEmailHtml({
  name,
  email,
  position,
  token,
  refCode,
}: {
  name: string;
  email: string;
  position: number;
  token: string;
  refCode: string;
}): string {
  const confirmUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist/confirm?token=${token}`;
  const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist?ref=${refCode}`;
  const unsubUrl    = `${process.env.NEXT_PUBLIC_APP_URL}/waitlist/unsubscribe?token=${token}`;

  const perks = [
    'Meet Sage, your 24/7 AI mentor, trained on African career context',
    "Live sessions with Africa's top professionals",
    'Peer mentorship circles matched to your life stage',
    'Career tools from student to executive level',
  ];

  const perkRows = perks.map(item => `
    <tr>
      <td style="width:24px;vertical-align:top;padding:4px 0;"><span style="color:#C8A96E;font-size:14px;">OK</span></td>
      <td style="padding:4px 0;font-size:14px;color:#3F3F3C;line-height:1.5;">${item}</td>
    </tr>`).join('');

  return brandedEmailLayout({
    preheader: `You're on the Ascentor waitlist, position #${position}.`,
    eyebrow: 'Waitlist Confirmed',
    heading: `You're in, ${esc(name)}.`,
    recipient: email,
    content:
      p(`Welcome to the Ascentor waitlist. You're position <strong>#${position}</strong> in line. Early members get <strong style="color:#C8A96E;">3 months free</strong> on launch.`) +
      summaryBox(
        summaryRow('Your position', `<span style="font-size:24px;color:#C8A96E;">#${position}</span>`) +
        summaryRow('Launch perk', '3 months free on any plan · No credit card needed')
      ) +
      p('Confirm your email to fully secure your spot:') +
      goldButton('Confirm My Email →', confirmUrl) +
      summaryBox(
        summaryRow('Move up faster', `Every friend you refer moves you up the list.`) +
        summaryRow('Your link', `<a href="${referralUrl}" style="color:#C8A96E;text-decoration:none;word-break:break-all;">${referralUrl}</a>`)
      ) +
      p('<strong>What you\'re getting access to:</strong>') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${perkRows}</table>` +
      p(`<span style="color:#9CA3AF;font-size:12px;"><a href="${unsubUrl}" style="color:#9CA3AF;">Unsubscribe</a> from waitlist emails</span>`),
  });
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
    const supabase = getSupabase();
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

    // Duplicate email - return 409 with their existing position
    if (data?.status === 'duplicate') {
      return NextResponse.json(
        { message: "You're already on the waitlist!", position: data.position },
        { status: 409 }
      );
    }

    // Send confirmation email - non-blocking (failure does not break the response)
    try {
      await sendEmail({
        from:    'Ascentor <hello@ascentorbi.com>',
        to:      body.email,
        subject: `You're on the Ascentor waitlist, position #${data.position}`,
        html:    buildConfirmationEmailHtml({
          name:     body.first_name,
          email:    body.email,
          position: data.position,
          token:    data.confirmation_token,
          refCode:  data.referral_code,
        }),
      });
    } catch (emailError) {
      // User is already saved - log only, do not fail the request
      console.error('[waitlist] Email error:', emailError);
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

// ── GET /api/waitlist - returns current total count ────────
export async function GET() {
  try {
    const { count, error } = await getSupabase()
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
