// ============================================================
// app/p/[subdomain]/join/page.tsx
//
// Partner invite acceptance page.
// URL: /p/[subdomain]/join?token=<signed_token>
//
// Flow:
//   1. Decode + verify HMAC token (expiry + signature check)
//   2. Look up the partner_member record for this email+partner
//   3. If user is already logged in + email matches → activate + redirect to dashboard
//   4. If user not logged in → redirect to signup with return URL
//   5. If token invalid/expired → show friendly error
// ============================================================

import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPartnerContext } from '@/lib/getPartnerContext';
import { verifyInviteToken } from '@/lib/inviteToken';
import Link from 'next/link';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: { token?: string };
}) {
  const { subdomain } = await params;
  const headersList = await headers();
  const hostname    = headersList.get('host') || '';
  const ctx         = await getPartnerContext(hostname);

  if (!ctx.isWhiteLabel) notFound();

  const { partner } = ctx;
  const { brand }   = partner;
  const token       = searchParams.token;

  // ── 1. Validate token presence ────────────────────────────
  if (!token) {
    return <JoinError brand={brand} subdomain={subdomain} message="This invite link is missing a token. Please ask the platform owner to resend your invitation." />;
  }

  // ── 2. Verify token signature + expiry ────────────────────
  let payload: { partnerId: string; email: string; expiresAt: number };
  try {
    payload = verifyInviteToken(token);
  } catch (err: any) {
    return (
      <JoinError
        brand={brand}
        subdomain={subdomain}
        message={err.message || 'This invite link is invalid or has expired.'}
      />
    );
  }

  // ── 3. Ensure token is for THIS partner ───────────────────
  if (payload.partnerId !== partner.id) {
    return <JoinError brand={brand} subdomain={subdomain} message="This invite link is not valid for this platform." />;
  }

  // ── 4. Find the member record ─────────────────────────────
  const { data: membership } = await supabaseService
    .from('partner_members')
    .select('id, status, user_id')
    .eq('partner_id', partner.id)
    .eq('email', payload.email)
    .maybeSingle();

  if (!membership) {
    return <JoinError brand={brand} subdomain={subdomain} message="No invitation was found for this email address. Please contact the platform owner." />;
  }

  if (membership.status === 'suspended' || membership.status === 'removed') {
    return <JoinError brand={brand} subdomain={subdomain} message="Your access to this platform has been revoked. Please contact the platform owner." />;
  }

  // ── 5. Check if user is already logged in ─────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Logged in — check their email matches the invite
    if (user.email?.toLowerCase() !== payload.email.toLowerCase()) {
      return (
        <JoinError
          brand={brand}
          subdomain={subdomain}
          message={`This invite is for ${payload.email}. You are currently logged in as ${user.email}. Please sign out and create an account with the invited email address.`}
        />
      );
    }

    // Email matches — activate the membership
    await supabaseService
      .from('partner_members')
      .update({
        status:    'active',
        user_id:   user.id,
        joined_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    // Redirect to partner dashboard
    redirect(`/p/${subdomain}/dashboard?joined=1`);
  }

  // ── 6. Not logged in — redirect to signup with context ────
  // Pass email as a hint so the signup form can pre-fill it
  const signupUrl = `/p/${subdomain}/signup?` + new URLSearchParams({
    invite: token,
    email:  payload.email,
  }).toString();

  redirect(signupUrl);
}

// ── Error UI ──────────────────────────────────────────────

function JoinError({
  brand,
  subdomain,
  message,
}: {
  brand: { platform_name: string; logo_url: string | null };
  subdomain: string;
  message: string;
}) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: 440, width: '100%', textAlign: 'center',
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--border)', padding: '40px 32px',
      }}>
        {brand.logo_url
          ? <img src={brand.logo_url} alt={brand.platform_name} style={{ height: 36, marginBottom: 24 }} />
          : <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 24 }}>
              {brand.platform_name}
            </p>
        }

        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: 'var(--text)', marginBottom: 12 }}>
          Invalid Invite Link
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 28 }}>
          {message}
        </p>

        <Link
          href={`/p/${subdomain}/login`}
          style={{
            display: 'inline-block', padding: '12px 28px',
            background: 'var(--accent)', color: '#000',
            borderRadius: 10, fontWeight: 700, fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
