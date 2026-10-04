// app/(app)/layout.tsx
// Shared shell for all authenticated member screens (Home, Coach, Circle,
// Sessions, Learn, Account, Referral). Renders the collapsible sidebar
// (drawer on mobile) and the sticky header with avatar + search via
// components/shell/UserShell. Auth + subscription gating already happens in
// proxy.ts - this layout assumes a valid session.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UserShell from '@/components/shell/UserShell';

// Matches the fixed summit date shown in the sidebar's mini-card
// ("19 Nov 2026 · Lagos"). Clamped at 0 so it never goes negative once
// the date has passed.
function getSummitDaysAway(): number {
  const diff = new Date('2026-11-19T00:00:00Z').getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Full query first; fall back to the original single column so a missing
  // optional column can never blank the whole app.
  let profile: { full_name: string | null; role?: string | null; avatar_url?: string | null } | null = null;
  const full = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single();
  if (full.data) {
    profile = full.data;
  } else {
    const basic = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    profile = basic.data;
  }

  // Onboarding gate. Members who have not finished onboarding (and are not staff,
  // paid, or already past the first step) are sent there; /onboarding sits outside
  // this layout so there is no redirect loop. Wrapped so a missing optional column
  // can never lock everyone out - on any query error we let the user through.
  const isStaffRole = profile?.role === 'admin' || profile?.role === 'moderator';
  if (!isStaffRole) {
    const ob = await supabase
      .from('profiles')
      .select('onboarding_completed, ascent_stage, subscription_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!ob.error && ob.data) {
      const paid = ob.data.subscription_status === 'active' || ob.data.subscription_status === 'trialing';
      if (ob.data.onboarding_completed !== true && !ob.data.ascent_stage && !paid) {
        redirect('/onboarding');
      }
    }
  }

  const userName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'there';

  return (
    <UserShell
      userName={userName}
      email={user.email}
      avatarUrl={profile?.avatar_url ?? null}
      role={profile?.role ?? null}
      summitDaysAway={getSummitDaysAway()}
    >
      {children}
    </UserShell>
  );
}
