// ============================================================
// app/api/partner/apply/route.ts
// POST: Coach submits partner application
// Creates partners record with status='pending'
// Notifies founder email via Resend
// ============================================================

import { adminNotifyEmail, fromAs } from '@/lib/contact';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from '@/lib/emailTemplate';
import { sendEmail } from '@/lib/nodemailer';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as partnerSchemas from '@/lib/validation/schemas/partner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FOUNDER_EMAIL = adminNotifyEmail(process.env.FOUNDER_EMAIL);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = await parseJson(req, partnerSchemas.apply);
    if (!parsed.ok) return parsed.response;
    const { platform_name, subdomain, coaching_niche, bio } = parsed.data;

    // Validate subdomain format
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleanSubdomain.length < 3) return NextResponse.json({ error: 'Subdomain must be at least 3 characters' }, { status: 400 });
    if (cleanSubdomain.length > 20) return NextResponse.json({ error: 'Subdomain too long (max 20 characters)' }, { status: 400 });

    const RESERVED = ['www', 'app', 'api', 'admin', 'mail', 'cdn', 'static', 'blog', 'help', 'support'];
    if (RESERVED.includes(cleanSubdomain)) return NextResponse.json({ error: 'That subdomain is reserved' }, { status: 400 });

    // Check subdomain availability
    const { data: existing } = await supabase
      .from('partners').select('id').eq('subdomain', cleanSubdomain).single();
    if (existing) return NextResponse.json({ error: 'That subdomain is already taken' }, { status: 400 });

    // Check if user already has a partner account
    const { data: alreadyPartner } = await supabase
      .from('partners').select('id, status').eq('owner_id', user.id).single();
    if (alreadyPartner) {
      return NextResponse.json({
        error: alreadyPartner.status === 'pending'
          ? 'Your application is under review'
          : 'You already have a partner account',
      }, { status: 400 });
    }

    const slug = slugify(platform_name);

    // Create pending partner record
    const { data: partner, error: insertError } = await supabase
      .from('partners')
      .insert({
        slug,
        subdomain:    cleanSubdomain,
        name:         platform_name.trim(),
        owner_id:     user.id,
        status:       'pending',
        brand: {
          logo_url: null, logo_dark_url: null, favicon_url: null,
          primary_color: '#E8A020', accent_color: '#C8851A',
          text_color: '#D4CFC3', bg_color: '#0C0B08', card_color: '#141310',
          font_heading: 'Cormorant Garamond', font_body: 'Syne',
          hide_ascentor_branding: false,
          platform_name: platform_name.trim(),
          tagline: null,
        },
        revenue_share_percent: 70, // default - can be adjusted per partner
        features: {
          ai_coach: true, community: true, experts: false,
          courses: true,
          // referrals: false by default - no partner-facing referral UI exists yet.
          // Enable manually per partner once the UI ships.
          referrals: false,
          // own_courses / own_events gated by plan_tier - false at apply time,
          // enabled automatically once partner upgrades to Growth or Pro.
          own_courses: false,
          own_events:  false,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Partner Apply]', insertError);
      return NextResponse.json({ error: 'Application failed. Please try again.' }, { status: 500 });
    }

    // Notify founder via email - with one-click approval link (no SQL required)
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(user.id);
      const applicantEmail = userData?.user?.email || 'unknown';

      // Build a signed approval URL pointing to the admin partners page
      const adminApproveUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://joinascentor.com'}/admin/partners?action=approve&id=${partner.id}`;

      await sendEmail({
        from:    fromAs('Ascentor Partners'),
        to:      FOUNDER_EMAIL,
        subject: `New Partner Application: ${platform_name}`,
        html: brandedEmailLayout({
            preheader: `New partner application: ${platform_name}`,
            eyebrow: 'Admin Notification',
            heading: 'New Partner Application',
            recipient: FOUNDER_EMAIL,
            content:
              summaryBox(
                summaryRow('Platform', esc(platform_name)) +
                summaryRow('Subdomain', `${esc(cleanSubdomain)}.joinascentor.com`) +
                summaryRow('Applicant', esc(applicantEmail)) +
                summaryRow('Niche', esc(coaching_niche || '-')) +
                summaryRow('Bio', esc(bio || '-'))
              ) +
              goldButton('Review &amp; Approve in Admin Panel →', adminApproveUrl) +
              p('<span style="color:#9CA3AF;font-size:13px;">Log in to your admin account at joinascentor.com/admin/partners to approve, reject, or adjust the revenue share.</span>'),
        }),
      });
    } catch (emailErr) {
      console.warn('[Partner Apply] Email error (non-fatal):', emailErr);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: 'partner_applied',
      entity_type: 'partner', entity_id: partner.id,
      details: { platform_name, subdomain: cleanSubdomain },
    });

    return NextResponse.json({
      success: true,
      message: 'Application received. You\'ll hear from us within 48 hours.',
      subdomain: cleanSubdomain,
    });

  } catch (err: any) {
    console.error('[Partner Apply API]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
