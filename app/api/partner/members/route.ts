// ============================================================
// PARTNER MEMBERS API — /api/partner/members
//
// GET    — paginated member list, with search + status filter
// POST   — invite single member OR bulk invite (array of emails)
// PATCH  — update member status: suspend | remove | reinstate
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
// Query params:
//   page    (default 1)
//   limit   (default 50, max 100)
//   search  (email or full_name substring)
//   status  (active | invited | suspended | removed | all)
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const partner = await getPartnerForUser(user.id);
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || 'all';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('partner_members')
      .select(`
        id, email, role, status, invited_at, joined_at,
        profiles (
          full_name, subscription_plan, subscription_status,
          subscription_end, avatar_url, last_sign_in_at
        )
      `, { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('invited_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Status filter — default excludes 'removed' unless explicitly requested
    if (status === 'all') {
      query = query.neq('status', 'removed');
    } else if (status !== 'any') {
      query = query.eq('status', status);
    }

    const { data: members, count, error: queryError } = await query;

    if (queryError) {
      console.error('[Members GET]', queryError);
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
    }

    // Client-side search filter (Supabase free tier doesn't support joined column filtering)
    const filtered = search
      ? (members || []).filter(m =>
          m.email.toLowerCase().includes(search.toLowerCase()) ||
          ((m.profiles as any)?.full_name || '').toLowerCase().includes(search.toLowerCase())
        )
      : (members || []);

    // Stats breakdown
    const { data: stats } = await supabase
      .from('partner_members')
      .select('status')
      .eq('partner_id', partner.id);

    const breakdown = (stats || []).reduce((acc: Record<string, number>, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      members: filtered,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      breakdown,
    });

  } catch (err: any) {
    console.error('[Members GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: Invite member(s) ────────────────────────────────
// Body: { email: string, role?: string }
//    OR { emails: string[], role?: string }  ← bulk
export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const partner = await getPartnerForUser(user.id);
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });
    if (partner.status !== 'active') return NextResponse.json({ error: 'Partner account not active' }, { status: 403 });

    const body = await req.json();
    const role = body.role || 'member';

    // Normalize to array — supports single or bulk
    const rawEmails: string[] = body.emails
      ? body.emails
      : body.email
        ? [body.email]
        : [];

    if (rawEmails.length === 0) {
      return NextResponse.json({ error: 'At least one email is required' }, { status: 400 });
    }
    if (rawEmails.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 emails per bulk invite' }, { status: 400 });
    }

    const emails = rawEmails.map(e => e.toLowerCase().trim()).filter(Boolean);
    const inviteUrl = `https://${partner.subdomain}.ascentorbi.com/join?partner=${partner.id}`;

    // Fetch all existing auth users once for lookup
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    const results: { email: string; status: 'invited' | 'active' | 'already_member' | 'error'; error?: string }[] = [];

    for (const email of emails) {
      try {
        // Check if already a member (non-removed)
        const { data: existing } = await supabase
          .from('partner_members')
          .select('id, status')
          .eq('partner_id', partner.id)
          .eq('email', email)
          .neq('status', 'removed')
          .maybeSingle();

        if (existing) {
          results.push({ email, status: 'already_member' });
          continue;
        }

        const existingUser = authUsers.find(u => u.email === email);
        const memberStatus = existingUser ? 'active' : 'invited';

        const { error: insertError } = await supabase
          .from('partner_members')
          .upsert({
            partner_id: partner.id,
            user_id:    existingUser?.id || null,
            email,
            role,
            status:     memberStatus,
            invited_at: new Date().toISOString(),
            joined_at:  existingUser ? new Date().toISOString() : null,
          }, { onConflict: 'partner_id,email' });

        if (insertError) {
          console.error('[Members POST] Insert error:', insertError);
          results.push({ email, status: 'error', error: 'Database insert failed' });
          continue;
        }

        // Send invite email (only for users who don't have an account yet)
        if (!existingUser) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from:    `${partner.name} <noreply@ascentorbi.com>`,
                to:      email,
                subject: `You've been invited to ${partner.name}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0C0B08; color: #D4CFC3; border-radius: 16px;">
                    <h2 style="color: #E8A020; font-size: 22px; margin-bottom: 16px;">${partner.name}</h2>
                    <p style="line-height: 1.7; color: #9C9890; margin-bottom: 24px;">
                      You've been personally invited to join <strong style="color: #D4CFC3;">${partner.name}</strong> — a private coaching community.
                    </p>
                    <a href="${inviteUrl}"
                       style="display: inline-block; padding: 14px 28px; background: #E8A020; color: #000;
                              text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
                      Accept Invitation →
                    </a>
                    <p style="margin-top: 28px; color: #5C5850; font-size: 11px; line-height: 1.6;">
                      This invite is for ${email} only.<br/>
                      Powered by <a href="https://ascentorbi.com" style="color: #E8A020;">Ascentor</a>
                    </p>
                  </div>
                `,
              }),
            });
          } catch (emailErr) {
            console.warn('[Members POST] Email send failed (non-fatal):', emailErr);
          }
        }

        results.push({ email, status: memberStatus });

      } catch (err: any) {
        results.push({ email, status: 'error', error: err.message });
      }
    }

    // Audit log
    const invited = results.filter(r => r.status === 'invited' || r.status === 'active');
    if (invited.length > 0) {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      emails.length > 1 ? 'partner_bulk_invite' : 'partner_member_invited',
        entity_type: 'partner',
        entity_id:   partner.id,
        details:     { emails: invited.map(r => r.email), role, count: invited.length },
      }).catch(() => {});
    }

    const successCount = results.filter(r => r.status === 'invited' || r.status === 'active').length;
    const skippedCount = results.filter(r => r.status === 'already_member').length;
    const errorCount   = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      results,
      summary: { invited: successCount, skipped: skippedCount, errors: errorCount },
    });

  } catch (err: any) {
    console.error('[Members POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── PATCH: Update member status ───────────────────────────
// Body: { memberId: string, action: 'suspend' | 'remove' | 'reinstate' | 'resend_invite' }
export async function PATCH(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const partner = await getPartnerForUser(user.id);
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const { memberId, action } = await req.json();
    if (!memberId || !action) {
      return NextResponse.json({ error: 'memberId and action required' }, { status: 400 });
    }

    // Confirm this member belongs to this partner
    const { data: member } = await supabase
      .from('partner_members')
      .select('id, email, status, user_id')
      .eq('id', memberId)
      .eq('partner_id', partner.id)
      .single();

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const STATUS_MAP: Record<string, string> = {
      suspend:  'suspended',
      remove:   'removed',
      reinstate: member.status === 'invited' ? 'invited' : 'active',
    };

    if (action === 'resend_invite') {
      if (member.status !== 'invited') {
        return NextResponse.json({ error: 'Can only resend to pending invites' }, { status: 400 });
      }
      const inviteUrl = `https://${partner.subdomain}.ascentorbi.com/join?partner=${partner.id}`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    `${partner.name} <noreply@ascentorbi.com>`,
            to:      member.email,
            subject: `Reminder: Your invite to ${partner.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0C0B08; color: #D4CFC3; border-radius: 16px;">
                <h2 style="color: #E8A020;">${partner.name}</h2>
                <p style="color: #9C9890; line-height: 1.7;">A reminder that you have a pending invitation to join <strong style="color: #D4CFC3;">${partner.name}</strong>.</p>
                <a href="${inviteUrl}" style="display: inline-block; margin-top: 16px; padding: 14px 28px; background: #E8A020; color: #000; text-decoration: none; border-radius: 10px; font-weight: 700;">
                  Accept Invitation →
                </a>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.warn('[Members PATCH] Resend email failed:', emailErr);
      }

      // Update invited_at so they go back to top of list
      await supabase
        .from('partner_members')
        .update({ invited_at: new Date().toISOString() })
        .eq('id', memberId);

      return NextResponse.json({ success: true, action: 'resend_invite' });
    }

    const newStatus = STATUS_MAP[action];
    if (!newStatus) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('partner_members')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', memberId);

    if (updateError) {
      console.error('[Members PATCH]', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id:     user.id,
      action:      `partner_member_${action}`,
      entity_type: 'partner',
      entity_id:   partner.id,
      details:     { member_email: member.email, from_status: member.status, to_status: newStatus },
    }).catch(() => {});

    return NextResponse.json({ success: true, action, newStatus });

  } catch (err: any) {
    console.error('[Members PATCH]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
