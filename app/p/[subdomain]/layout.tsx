// ============================================================
// WHITE-LABEL SHELL LAYOUT — app/p/[subdomain]/layout.tsx
//
// ROOT CAUSE FIX:
//   Previously this layout rendered its own <html><head><body>,
//   which caused Next.js to skip app/layout.tsx entirely.
//   That meant globals.css — and therefore Tailwind — never
//   loaded on any whitelabel page.
//
// FIX:
//   - Removed <html>/<head>/<body>. This layout is now a normal
//     nested layout; app/layout.tsx handles the document shell
//     and Tailwind loads correctly.
//   - Partner CSS vars are injected via a wrapper <div> with
//     inline style. CSS custom properties inherit through the
//     DOM so all children still receive the partner's brand
//     colours, overriding the Ascentor defaults.
//   - Partner fonts are loaded via a <style>/@import in the
//     wrapper, injected as a <style> tag before content.
//   - Favicon + title still set via generateMetadata (Next.js
//     merges these into the root <head> automatically).
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

// Pages inside /p/[subdomain]/ that are always public
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/join',
  '/access-denied',
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
  const partnerPathname = headersList.get('x-partner-pathname') || '';
  const isPublicPath =
    PUBLIC_PATHS.some(p =>
      partnerPathname === p ||
      partnerPathname.startsWith(p + '?') ||
      partnerPathname.endsWith(p) ||
      partnerPathname.includes(p + '?')
    );

  // ── 3. Whitelist check on protected pages ─────────────────
  let isOwner = false;

  if (!isPublicPath) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect(`/p/${subdomain}/login?redirect=${encodeURIComponent(partnerPathname || `/p/${subdomain}/dashboard`)}`);
    }

    isOwner = partner.owner_id === user.id;

    const { data: membership } = await supabaseService
      .from('partner_members')
      .select('id, status')
      .eq('partner_id', partner.id)
      .eq('email', user.email!)
      .maybeSingle();

    if (!membership) {
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

  // ── 4. Build partner CSS vars + font imports ──────────────
  // Vars are injected on a wrapper div — CSS custom properties
  // inherit through the DOM so all children get the partner brand.
  const cssVarObject = Object.fromEntries(
    Object.entries(cssVars)
  ) as React.CSSProperties;

  const fontsNeeded  = [...new Set([brand.font_heading, brand.font_body])];
  const fontFamilies = fontsNeeded
    .map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');

  const partnerFontUrl = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;

  return (
    <>
      {/*
        Inject partner Google Fonts as a <style> @import.
        This piggybacks on the existing document <head> that
        app/layout.tsx already renders — no duplicate <html>.
      */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('${partnerFontUrl}');` }} />

      {/*
        Wrapper div scopes all partner CSS variable overrides.
        Because CSS custom properties are inherited, every child
        component that reads var(--bg), var(--accent), etc. will
        get the partner's values instead of Ascentor defaults.
      */}
      <div style={cssVarObject as React.CSSProperties}>
        <PartnerProvider context={ctx}>
          {isPublicPath ? children : (
            <PartnerMemberShell partner={partner} isOwner={isOwner}>
              {children}
            </PartnerMemberShell>
          )}
        </PartnerProvider>
      </div>
    </>
  );
}

// ── Dynamic metadata — merged into root <head> by Next.js ────
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
    description: brand.tagline ?? undefined,
    icons:       brand.favicon_url ? [{ url: brand.favicon_url }] : [],
  };
}
