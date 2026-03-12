// ============================================================
// WHITE-LABEL SHELL LAYOUT — app/p/[subdomain]/layout.tsx
//
// WHITELIST ENFORCEMENT (new):
// After resolving the partner context, checks whether the
// currently-logged-in user is an active member of this partner.
//
// Rules:
//   - Public pages (/, /login, /signup, /join) — always pass through.
//     The user must be able to reach login/signup to become a member.
//   - Unauthenticated users on protected pages — redirect to partner login.
//   - Authenticated users NOT in partner_members — redirect to /p/[subdomain]/access-denied.
//   - Authenticated users with status 'invited' — auto-activate them, then allow.
//   - Authenticated users with status 'suspended' or 'removed' — block.
// ============================================================

import { headers }       from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPartnerContext } from '@/lib/getPartnerContext';
import { PartnerProvider }   from '@/components/partner/PartnerProvider';
import PartnerMemberShell  from '@/components/partner/PartnerMemberShell';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pages inside /p/[subdomain]/ that are always public —
// the user must be able to reach these without being a member yet.
const PUBLIC_PATHS = [
  '/',               // landing page — always public
  '/login',
  '/signup',
  '/join',           // invite accept page
  '/access-denied',  // shown when blocked
  '/checkout',       // pricing/checkout page — public so guests can see plans
];

export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const headersList   = await headers();
  const hostname      = headersList.get('host') || '';

  // ── 1. Resolve partner context ────────────────────────────
  const ctx = await getPartnerContext(hostname);
  if (!ctx.isWhiteLabel) notFound();

  const { partner, cssVars } = ctx;
  const brand = partner.brand;

  // ── 2. Determine current path ─────────────────────────────
  // proxy.ts sets x-partner-pathname on all /p/* rewrites.
  // For subdomain rewrites (demo.ascentorbi.com/login → /p/demo/login)
  // the header contains the original path e.g. '/login'.
  // For direct /p/* access it contains the full path e.g. '/p/demo/login'.
  const partnerPathname = headersList.get('x-partner-pathname') || '';
  const isPublicPath =
    PUBLIC_PATHS.some(p => {
      if (p === '/') return partnerPathname === '/';
      return (
        partnerPathname === p ||
        partnerPathname.startsWith(p + '?') ||
        partnerPathname.startsWith(p + '/') ||
        partnerPathname.endsWith(p) ||
        partnerPathname.includes(p + '?')
      );
    });

  // ── 3. Whitelist check on protected pages ─────────────────
  let isOwner = false;

  if (!isPublicPath) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not logged in — redirect to partner login
      redirect(`/p/${subdomain}/login?redirect=${encodeURIComponent(partnerPathname || `/p/${subdomain}/dashboard`)}`);
    }

    // Detect if this user is the partner owner
    isOwner = partner.owner_id === user.id;

    // Check membership in partner_members
    const { data: membership } = await supabaseService
      .from('partner_members')
      .select('id, status')
      .eq('partner_id', partner.id)
      .eq('email', user.email!)
      .maybeSingle();

    if (!membership) {
      // Owner always has access even if not explicitly in partner_members
      if (!isOwner) {
        redirect(`/p/${subdomain}/access-denied?reason=not_invited`);
      }
    } else {
      if (membership.status === 'suspended' && !isOwner) {
        redirect(`/p/${subdomain}/access-denied?reason=suspended`);
      }

      if (membership.status === 'removed' && !isOwner) {
        redirect(`/p/${subdomain}/access-denied?reason=removed`);
      }

      // Auto-activate 'invited' members who have now logged in
      if (membership.status === 'invited') {
        await supabaseService
          .from('partner_members')
          .update({
            status:    'active',
            user_id:   user.id,
            joined_at: new Date().toISOString(),
          })
          .eq('id', membership.id);
      }
    }
  }

  // ── 4. Build CSS vars ─────────────────────────────────────
  const cssVarString = Object.entries(cssVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  const fontsNeeded  = [...new Set([brand.font_heading, brand.font_body])];
  const fontFamilies = fontsNeeded
    .map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{brand.platform_name}</title>
        {brand.tagline && <meta name="description" content={brand.tagline} />}

        {brand.favicon_url && (
          <link rel="icon" href={brand.favicon_url} />
        )}

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`}
          rel="stylesheet"
        />

        <style>{`
          :root { ${cssVarString}; }

          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: var(--font-body, 'Syne', sans-serif);
            min-height: 100vh;
          }

          h1, h2, h3 {
            font-family: var(--font-heading, 'Cormorant Garamond', Georgia, serif);
          }

          input, select, textarea {
            background: var(--bg-input);
            color: var(--text);
            border: 1px solid var(--border);
          }

          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: var(--bg); }
          ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }
        `}</style>
      </head>
      <body style={{ background: 'var(--bg)' }}>
        <PartnerProvider context={ctx}>
          {isPublicPath ? children : (
            <PartnerMemberShell partner={partner} isOwner={isOwner}>
              {children}
            </PartnerMemberShell>
          )}
        </PartnerProvider>
      </body>
    </html>
  );
}

// ── Dynamic metadata per partner ─────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  await params;
  const headersList = await headers();
  const hostname    = headersList.get('host') || '';
  const ctx         = await getPartnerContext(hostname);

  if (!ctx.isWhiteLabel) return {};

  const { brand } = ctx.partner;
  return {
    title:       brand.platform_name,
    description: brand.tagline,
    icons:       brand.favicon_url ? [{ url: brand.favicon_url }] : [],
  };
}
