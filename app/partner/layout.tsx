// ============================================================
// app/partner/layout.tsx
// Partner admin portal layout — sidebar nav, auth guard,
// partner ownership check. Matches AccountClient visual style.
// Accessible at: /partner/* (on the coach's subdomain)
// ============================================================

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PartnerAdminShell from '@/components/partner/PartnerAdminShell';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PartnerAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── 1. Auth check ─────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?redirect=/partner');

  // ── 2. Partner ownership check ────────────────────────────
  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, name, subdomain, status, brand, revenue_share_percent, onboarded_at')
    .eq('owner_id', user.id)
    .single();

  if (!partner) redirect('/dashboard'); // Not a coach partner — not allowed here

  // ── 3. Suspended check ────────────────────────────────────
  if (partner.status === 'suspended') {
    redirect('/dashboard?error=partner_suspended');
  }

  // ── 4. Redirect new partners to onboarding ────────────────
  // Pending partners shouldn't access admin until approved
  if (partner.status === 'pending') {
    redirect('/dashboard?info=partner_pending');
  }

  // Active partners who haven't completed onboarding get the checklist
  // (unless they're already on the onboarding page — avoid redirect loop)
  const { headers: hdrs } = await import('next/headers');
  const headersList = await hdrs();
  const pathname = headersList.get('x-invoke-path') || '';
  const isOnOnboarding = pathname.includes('/onboarding');

  if (!partner.onboarded_at && !isOnOnboarding) {
    redirect('/partner/onboarding');
  }

  return (
    <PartnerAdminShell partner={partner} userId={user.id}>
      {children}
    </PartnerAdminShell>
  );
}
