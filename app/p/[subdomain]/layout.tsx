// app/p/[subdomain]/layout.tsx
//
// FIX WL-08: Replaced the old getTenant() query against the "tenants" table
//            with getPartnerContext(hostname). This ensures both the member
//            layout and the admin layout read from the same "partners" table
//            via the same cache-backed function.
//
//            The proxy.ts rewrites demo.ascentorbi.com/dashboard
//            → /p/demo/dashboard, keeping the browser URL unchanged.
//            This layout sets partner CSS vars + wraps public/member pages
//            in PartnerMemberShell. Admin pages use admin/layout.tsx instead.

export const dynamic = 'force-dynamic';

import { headers }     from 'next/headers';
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

  // 1. Resolve partner via getPartnerContext (uses partners table + cache)
  const ctx = await getPartnerContext(hostname);
  if (!ctx.isWhiteLabel) notFound();

  const { partner, cssVars } = ctx;
  const brand = partner.brand;

  // 2. Determine current path from proxy header
  const partnerPathname = headersList.get('x-partner-pathname') || '';
  const isPublicPath = PUBLIC_PATHS.some(p =>
    partnerPathname === p ||
    partnerPathname.startsWith(p + '?') ||
    partnerPathname.endsWith(p)
  );

  // 3. Auth + membership check for protected paths
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

    if (!membership && !isOwner) {
      redirect(`/p/${subdomain}/access-denied?reason=not_invited`);
    }

    if (membership) {
      if (membership.status === 'suspended' && !isOwner) {
        redirect(`/p/${subdomain}/access-denied?reason=suspended`);
      }
      if (membership.status === 'removed' && !isOwner) {
        redirect(`/p/${subdomain}/access-denied?reason=removed`);
      }
      // Auto-activate on first login
      if (membership.status === 'invited') {
        await supabaseService
          .from('partner_members')
          .update({ status: 'active', joined_at: new Date().toISOString() })
          .eq('id', membership.id);
      }
    }
  }

  // 4. Build CSS vars + partner fonts
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
  await params;
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
