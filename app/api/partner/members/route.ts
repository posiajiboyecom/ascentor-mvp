// ============================================================
// FILE LOCATION: app/api/partner/members/route.ts
//
// BUG FIXED:
//   BUG-08 — The GET handler applied the search filter client-side
//             AFTER the paginated DB query. This meant:
//               - Page 1 returned up to 50 records, then filtered
//                 down to matching emails/names within those 50.
//               - Page 2+ returned records 51-100, filtered within
//                 that window — a search for "alice" on page 2
//                 would miss all "alice" entries on page 1.
//               - The 'total' and 'pages' counts came from the
//                 unfiltered DB count, making pagination controls
//                 show the wrong number of pages.
//
//             Fix: when a search term is present, do a single
//             un-paginated query on the email column (which is
//             stored on partner_members directly). full_name lives
//             on the joined profiles table so we do a second query
//             to get user_ids matching the name, then OR both sets.
//             Results are then paginated in-process on the already-
//             filtered set. This keeps Supabase free-tier compatible
//             (no ilike on joined columns) while fixing correctness.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createInviteToken } from '@/lib/inviteToken';

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
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || 'all';
    const offset = (page - 1) * limit;

    // FIX BUG-08: When searching, fetch all matching members first,
    // then paginate. When not searching, use DB-level pagination.
    if (search) {
      // Step 1: find user_ids whose full_name matches the search term
      const { data: profileMatches } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${search}%`);

      const matchingUserIds = (profileMatches || []).map(p => p.id);

      // Step 2: fetch all members matching by email OR by user_id (name match)
      let allQuery = supabase
        .from('partner_members')
        .select(`
          id, email, role, status, invited_at, joined_at,
          profiles (
            full_name, subscription_plan, subscription_status,
            subscription_end, avatar_url, last_sign_in_at
          )
        `)
        .eq('partner_id', partner.id);

      if (status === 'all') {
        allQuery = allQuery.neq('status', 'removed');
      } else if (status !== 'any') {
        allQuery = allQuery.eq('status', status);
      }

      // Build OR filter: email match OR user_id in name-match set
      const emailFilter = `email.ilike.%${search}%`;
      const userIdFilter = matchingUserIds.length > 0
        ? `,user_id.in.(${matchingUserIds.join(',')})`
        : '';

      allQuery = allQuery.or(`${emailFilter}${userIdFilter}`);
      allQuery = allQuery.order('invited_at', { ascending: false });

      const { data: allMembers, error: queryError } = await allQuery;

      if (queryError) {
        console.error('[Members GET search]', queryError);
        return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
      }

      const total    = (allMembers || []).length;
      const paginated = (allMembers || []).slice(offset, offset + limit);

      // Stats breakdown (always from full unfiltered set)
      const { data: stats } = await supabase
        .from('partner_members')
        .select('status')
        .eq('partner_id', partner.id);

      const breakdown = (stats || []).reduce((acc: Record<string, number>, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
      }, {});

      return NextResponse.json({
        members:   paginated,
        total,
        page,
        pages:     Math.ceil(total / limit),
        breakdown,
      });
    }

    // ── No search — use DB-level pagination (original path) ──
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

    const { data: stats } = await supabase
      .from('partner_members')
      .select('status')
      .eq('partner_id', partner.id);

    const breakdown = (stats || []).reduce((acc: Record<string, number>, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      members: members || [],
      total:   count || 0,
      page,
      pages:   Math.ceil((count || 0) / limit),
      breakdown,
    });

  } catch (err: any) {
    console.error('[Members GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: Invite member(s) ────────────────────────────────
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

    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    const results: { email: string; status: 'invited' | 'active' | 'already_member' | 'error'; error?: string }[] = [];

    for (const email of emails) {
      try {
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

        const existingUser  = authUsers.find(u => u.email === email);
        const memberStatus  = existingUser ? 'active' : 'invited';

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

        if (!existingUser) {
          try {
            const token     = createInviteToken(partner.id, email);
            const inviteUrl = `https://${partner.subdomain}.ascentorbi.com/join?token=${encodeURIComponent(token)}`;

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

    const invited      = results.filter(r => r.status === 'invited' || r.status === 'active');
    const successCount = invited.length;
    const skippedCount = results.filter(r => r.status === 'already_member').length;
    const errorCount   = results.filter(r => r.status === 'error').length;

    if (invited.length > 0) {
      try {
        await supabase.from('audit_logs').insert({
          user_id:     user.id,
          action:      emails.length > 1 ? 'partner_bulk_invite' : 'partner_member_invited',
          entity_type: 'partner',
          entity_id:   partner.id,
          details:     { emails: invited.map(r => r.email), role, count: invited.length },
        });
      } catch { /* non-critical */ }
    }

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

    const { data: member } = await supabase
      .from('partner_members')
      .select('id, email, status, user_id')
      .eq('id', memberId)
      .eq('partner_id', partner.id)
      .single();

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const STATUS_MAP: Record<string, string> = {
      suspend:   'suspended',
      remove:    'removed',
      reinstate: member.status === 'invited' ? 'invited' : 'active',
    };

    if (action === 'resend_invite') {
      if (member.status !== 'invited') {
        return NextResponse.json({ error: 'Can only resend to pending invites' }, { status: 400 });
      }
      const token     = createInviteToken(partner.id, member.email);
      const inviteUrl = `https://${partner.subdomain}.ascentorbi.com/join?token=${encodeURIComponent(token)}`;
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

    try {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      `partner_member_${action}`,
        entity_type: 'partner',
        entity_id:   partner.id,
        details:     { member_email: member.email, from_status: member.status, to_status: newStatus },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, action, newStatus });

  } catch (err: any) {
    console.error('[Members PATCH]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
