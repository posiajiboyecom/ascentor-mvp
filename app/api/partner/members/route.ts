// ============================================================
// PARTNER MEMBERS API — /api/partner/members
// Manage who belongs to a partner's platform
// GET:  List all members for the authenticated partner
// POST: Invite a member (sends email)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPartnerForUser(userId: string) {
  const { data } = await supabase
    .from('partners')
    .select('id, name, subdomain, status')
    .eq('owner_id', userId)
    .single();
  return data;
}

// ── GET: List members ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const partner = await getPartnerForUser(user.id);
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;

    const { data: members, count } = await supabase
      .from('partner_members')
      .select(`
        id, email, role, status, invited_at, joined_at,
        profiles (
          full_name, subscription_plan, subscription_status,
          subscription_end, avatar_url
        )
      `, { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('joined_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({
      members: members || [],
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: Invite a member ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const partner = await getPartnerForUser(user.id);
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });
    if (partner.status !== 'active') return NextResponse.json({ error: 'Partner not active' }, { status: 403 });

    const { email, role = 'member' } = await req.json();
    if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already a member
    const { data: existing } = await supabase
      .from('partner_members')
      .select('id, status')
      .eq('partner_id', partner.id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'This member is already in your community' }, { status: 400 });
    }

    // Check if Ascentor user exists
    const { data: authData } = await supabase.auth.admin.listUsers();
    const existingUser = authData?.users?.find(u => u.email === normalizedEmail);

    // Insert member record
    const { data: member, error: insertError } = await supabase
      .from('partner_members')
      .insert({
        partner_id:  partner.id,
        user_id:     existingUser?.id || null,
        email:       normalizedEmail,
        role,
        status:      existingUser ? 'active' : 'invited',
        invited_at:  new Date().toISOString(),
        joined_at:   existingUser ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Members] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }

    // Send invite email via Resend
    try {
      const inviteUrl = `https://${partner.subdomain}.ascentorbi.com/join?partner=${partner.id}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    `${partner.name} <noreply@ascentorbi.com>`,
          to:      normalizedEmail,
          subject: `You've been invited to ${partner.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;">
              <h2 style="color: #1a1a1a;">You're invited to ${partner.name}</h2>
              <p style="color: #666; line-height: 1.6;">
                ${partner.name} has invited you to join their coaching community.
                Click the link below to get started.
              </p>
              <a href="${inviteUrl}"
                 style="display: inline-block; margin-top: 20px; padding: 12px 28px;
                        background: #E8A020; color: #000; text-decoration: none;
                        border-radius: 8px; font-weight: 700;">
                Join ${partner.name} →
              </a>
              <p style="margin-top: 24px; color: #999; font-size: 12px;">
                Powered by Ascentor · <a href="https://ascentorbi.com" style="color: #999;">ascentorbi.com</a>
              </p>
            </div>
          `,
        }),
      });
    } catch (emailErr) {
      console.warn('[Members] Email error (non-fatal):', emailErr);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id:     user.id,
      action:      'partner_member_invited',
      entity_type: 'partner',
      entity_id:   partner.id,
      details:     { email: normalizedEmail, role },
    });

    return NextResponse.json({ success: true, member });

  } catch (err: any) {
    console.error('[Members API]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
