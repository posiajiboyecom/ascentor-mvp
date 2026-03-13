// app/p/[subdomain]/admin/layout.tsx
//
// FIXES:
//   WL-01 — PartnerMemberShell → PartnerAdminShell (correct sidebar shell)
//   WL-09 — Owner-only guard (non-owners redirected to access-denied)
//
// HOW ADMIN ROUTING WORKS:
//   User on demo.ascentorbi.com clicks "Admin" → href="/admin/brand"
//   Proxy rewrites: /admin/brand → /p/demo/admin/brand (internal)
//   This layout loads at /p/demo/admin/*, wraps children in PartnerAdminShell.
//   basePath="/admin" so sidebar links stay as /admin/brand, /admin/members etc.
//   Proxy rewrites each of those to /p/demo/admin/brand etc. transparently.

import { headers }   from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPartnerContext } from '@/lib/getPartnerContext';
import { PartnerProvider }  from '@/components/partner/PartnerProvider';
import PartnerAdminShell    from '@/components/partner/PartnerAdminShell';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PartnerAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const headersList   = await headers();
  const hostname      = headersList.get('host') || '';

  // 1. Resolve partner
  const ctx = await getPartnerContext(hostname);

  // Fallback for local dev / missing host header
  if (!ctx.isWhiteLabel) {
    const { data: partnerRow } = await supabaseService
      .from('partners')
      .select('id, owner_id, status')
      .eq('subdomain', subdomain.toLowerCase())
      .eq('status', 'active')
      .single();
    if (!partnerRow) notFound();
  }

  if (!ctx.isWhiteLabel) notFound();

  const { partner, cssVars } = ctx;
  const brand = partner.brand;

  // 2. Auth — admin is always protected
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const currentPath = headersList.get('x-partner-pathname') || '/admin';
    redirect(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  // 3. Owner-only guard
  const isOwner = partner.owner_id === user.id;
  if (!isOwner) {
    redirect(`/access-denied?reason=not_admin`);
  }

  // 4. CSS vars + fonts
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
          {/*
            basePath="/admin" — sidebar links are /admin/brand, /admin/members etc.
            Proxy rewrites those to /p/demo/admin/brand etc. transparently.
          */}
          <PartnerAdminShell partner={partner} userId={user.id} basePath="/admin">
            {children}
          </PartnerAdminShell>
        </PartnerProvider>
      </div>
    </>
  );
}

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
    title:       `Admin — ${brand.platform_name}`,
    description: brand.tagline ?? undefined,
    icons:       brand.favicon_url ? [{ url: brand.favicon_url }] : [],
  };
}
