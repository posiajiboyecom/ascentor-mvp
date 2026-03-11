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
    .select('id, name, subdomain, status, brand, revenue_share_percent')
    .eq('owner_id', user.id)
    .single();

  if (!partner) redirect('/dashboard'); // Not a coach partner — not allowed here

  // ── 3. Suspended check ────────────────────────────────────
  if (partner.status === 'suspended') {
    redirect('/dashboard?error=partner_suspended');
  }

  return (
    <PartnerAdminShell partner={partner} userId={user.id}>
      {children}
    </PartnerAdminShell>
  );
}
