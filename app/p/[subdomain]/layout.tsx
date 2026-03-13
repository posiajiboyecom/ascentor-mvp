// app/p/[subdomain]/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL FIX: Replaced getTenant() (old "tenants" table) with
// getPartnerContext(hostname). Partners live in the "partners" table —
// any partner not in "tenants" caused notFound() on every page.
//
// HOW PROXY ROUTING WORKS (proxy.ts at project root):
//   User visits: demo.ascentorbi.com/coach
//   Proxy sees:  host = demo.ascentorbi.com → subdomain = "demo"
//   Rewrites to: /p/demo/coach  (internal, browser URL unchanged)
//   Sets header: x-partner-pathname = /coach
//   Sets header: x-partner-subdomain = demo
//
// This layout receives the rewritten request at /p/[subdomain]/coach.
// getPartnerContext(hostname) uses the ORIGINAL host header (demo.ascentorbi.com)
// to look up the partner — the regex /^([^.]+)\.ascentorbi\.com$/ matches correctly.
//
// Nav links in PartnerMemberShell stay as root-relative (/dashboard, /coach,
// /admin/brand etc.) — the proxy rewrites them on each navigation. Do NOT
// prefix them with /p/${sub}/ — the proxy handles that transparently.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

import { headers }   from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPartnerContext } from '@/lib/getPartnerContext';
import { PartnerProvider }  from '@/components/partner/PartnerProvider';
import PartnerMemberShell   from '@/components/partner/PartnerMemberShell';
import type { Metadata } from 'next';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLIC_PATHS = ['/login', '/signup', '/join', '/access-denied'];

export default async function SubdomainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const headersList   = await headers();
  const hostname      = headersList.get('host') || '';

  // ── 1. Resolve partner ────────────────────────────────────
  // Primary: use hostname (works when proxy rewrites *.ascentorbi.com)
  let ctx = await getPartnerContext(hostname);

  // Fallback: if hostname didn't resolve (local dev, missing host header),
  // try a direct lookup by subdomain param
  if (!ctx.isWhiteLabel) {
    const { data: partnerRow } = await supabaseService
      .from('partners')
      .select(`
        id, name, slug, subdomain, custom_domain, status, owner_id,
        revenue_share_percent, paystack_subaccount_code,
        brand, features, plan_overrides,
        created_at, updated_at, onboarded_at
      `)
      .eq('subdomain', subdomain.toLowerCase())
      .eq('status', 'active')
      .single();

    if (!partnerRow) notFound();

    // Build ctx from the direct DB hit
    const { getPartnerContext: _gcpc, ...ctxModule } = await import('@/lib/getPartnerContext');
    // Re-use exported clearPartnerCache type — we only need cssVars here
    const DEFAULT_BRAND = {
      platform_name: 'Partner Platform', tagline: null,
      logo_url: null, logo_dark_url: null, favicon_url: null,
      primary_color: '#E8A020', accent_color: '#C87820',
      text_color: '#D4CFC3', bg_color: '#0C0B08', card_color: '#1E1C17',
      border_color: '#2A2720', font_heading: 'Cormorant Garamond',
      font_body: 'Syne', hide_ascentor_branding: false,
    };
    const brand = { ...DEFAULT_BRAND, ...(partnerRow.brand || {}) };
    const cssVars: Record<string, string> = {
      '--bg': brand.bg_color, '--bg-card': brand.card_color,
      '--text': brand.text_color, '--accent': brand.primary_color,
      '--accent-hover': brand.accent_color,
      '--border': brand.border_color || `rgba(212,207,195,0.10)`,
      '--text-dim': brand.text_color, '--font-heading': `'${brand.font_heading}', Georgia, serif`,
      '--font-body': `'${brand.font_body}', system-ui, sans-serif`,
    };
    ctx = { isWhiteLabel: true, partner: { ...partnerRow, brand } as any, cssVars };
  }

  const { partner, cssVars } = ctx;
  const brand = partner.brand;

  // ── 2. Current pathname ──────────────────────────────────
  // Proxy injects x-partner-pathname with the original path before rewrite
  const partnerPathname = headersList.get('x-partner-pathname') || '';
  const isPublicPath = PUBLIC_PATHS.some(p =>
    partnerPathname === p ||
    partnerPathname.startsWith(p + '?') ||
    partnerPathname.endsWith(p)
  );

  // ── 3. Auth + membership ─────────────────────────────────
  let isOwner = false;

  if (!isPublicPath) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to partner login (proxy will rewrite /login → /p/${sub}/login)
      redirect(`/login?redirect=${encodeURIComponent(partnerPathname || '/dashboard')}`);
    }

    isOwner = partner.owner_id === user.id;

    const { data: membership } = await supabaseService
      .from('partner_members')
      .select('id, status')
      .eq('partner_id', partner.id)
      .eq('email', user.email!)
      .maybeSingle();

    if (!membership && !isOwner) {
      redirect(`/access-denied?reason=not_invited`);
    }

    if (membership) {
      if (membership.status === 'suspended' && !isOwner) redirect(`/access-denied?reason=suspended`);
      if (membership.status === 'removed'    && !isOwner) redirect(`/access-denied?reason=removed`);
      if (membership.status === 'invited') {
        await supabaseService
          .from('partner_members')
          .update({ status: 'active', joined_at: new Date().toISOString() })
          .eq('id', membership.id);
      }
    }
  }

  // ── 4. CSS vars + fonts ──────────────────────────────────
  const cssVarObject = Object.fromEntries(Object.entries(cssVars)) as React.CSSProperties;
  const fontsNeeded  = [...new Set([brand.font_heading, brand.font_body])];
  const fontFamilies = fontsNeeded
    .map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');
  const partnerFontUrl = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@import url('${partnerFontUrl}');` }} />
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const headersList = await headers();
  const hostname    = headersList.get('host') || '';
  const ctx         = await getPartnerContext(hostname);
  if (!ctx.isWhiteLabel) return { title: 'Not Found' };
  const { brand } = ctx.partner;
  return {
    title:       { default: brand.platform_name, template: `%s | ${brand.platform_name}` },
    description: brand.tagline ?? `AI-powered coaching platform by ${brand.platform_name}`,
    icons:       brand.favicon_url ? [{ url: brand.favicon_url }] : [],
  };
}
