// ============================================================
// app/p/[subdomain]/admin/layout.tsx
//
// Partner admin portal — scoped inside the whitelabel shell.
// Mirrors app/partner/layout.tsx but:
//   - Lives at /p/[subdomain]/admin/* so it inherits the
//     whitelabel layout's Tailwind + CSS var scope
//   - Redirects use subdomain-aware paths
//   - Passes basePath to PartnerAdminShell so all nav links
//     and the "Back to platform" link are subdomain-correct
// ============================================================

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PartnerAdminShell from '@/components/partner/PartnerAdminShell';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function WhitelabelAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const base = '/admin';

  // ── 1. Auth check ─────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect(`/p/${subdomain}/login?redirect=${base}`);

  // ── 2. Partner ownership check ────────────────────────────
  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, name, subdomain, status, brand, revenue_share_percent, onboarded_at')
    .eq('owner_id', user.id)
    .single();

  if (!partner) redirect('/dashboard');

  // ── 3. Suspended / pending check ──────────────────────────
  if (partner.status === 'suspended') {
    redirect('/dashboard?error=partner_suspended');
  }
  if (partner.status === 'pending') {
    redirect('/dashboard?info=partner_pending');
  }

  // ── 4. Onboarding gate ────────────────────────────────────
  const headersList = await headers();
  const pathname = headersList.get('x-invoke-path') || '';
  const isOnOnboarding = pathname.includes('/onboarding');

  if (!partner.onboarded_at && !isOnOnboarding) {
    redirect('/admin/onboarding');
  }

  return (
    <PartnerAdminShell partner={partner} userId={user.id} basePath={base}>
      {children}
    </PartnerAdminShell>
  );
}
