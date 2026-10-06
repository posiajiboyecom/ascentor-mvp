// app/(app)/layout.tsx
// Shared shell for all authenticated member screens (Home, Coach, Circle,
// Sessions, Learn, Account, Referral). Renders the collapsible sidebar
// (drawer on mobile) and the sticky header with avatar + search via
// components/shell/UserShell. Auth + subscription gating happens in proxy.ts;
// this layout also enforces the onboarding gate.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shell-data';
import UserShell from '@/components/shell/UserShell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShellData();
  if (!shell) redirect('/login');

  // Onboarding gate. Members who have not finished onboarding (and are not staff,
  // paid, or already past the first step) are sent there; /onboarding sits outside
  // this layout so there is no redirect loop. On any query error we let the user
  // through, so a missing optional column can never lock everyone out.
  const isStaffRole = shell.role === 'admin' || shell.role === 'moderator';
  if (!isStaffRole) {
    const supabase = await createClient();
    const ob = await supabase
      .from('profiles')
      .select('onboarding_completed, primary_dimension, subscription_status')
      .eq('id', shell.userId)
      .maybeSingle();
    if (!ob.error && ob.data) {
      const paid = ob.data.subscription_status === 'active' || ob.data.subscription_status === 'trialing';
      if (ob.data.onboarding_completed !== true && !ob.data.primary_dimension && !paid) {
        redirect('/onboarding');
      }
    }
  }

  return (
    <UserShell
      userId={shell.userId}
      userName={shell.userName}
      email={shell.email}
      avatarUrl={shell.avatarUrl}
      role={shell.role}
      summitRegistered={shell.summitRegistered}
    >
      {children}
    </UserShell>
  );
}
