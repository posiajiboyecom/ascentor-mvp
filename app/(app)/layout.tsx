// app/(app)/layout.tsx
// Shared shell for all authenticated screens (Home, Coach, Circle,
// Sessions, Resources). Renders the desktop left rail at >= lg and
// the mobile bottom tab bar below it. Auth + subscription gating
// already happens in proxy.ts — this layout assumes a valid session.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { daysUntilSummit } from '@/lib/elevationSummit';
import { DesktopRail } from '@/components/nav/DesktopRail';
import { MobileTabBar } from '@/components/nav/MobileTabBar';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const userName = profile?.full_name?.trim() || 'there';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background-primary)]">
      <DesktopRail
        userName={userName}
        userInitials={getInitials(userName)}
        summitDaysAway={daysUntilSummit()}
      />
      <div className="flex-1 min-w-0 h-full pb-[78px] lg:pb-0">
        {children}
      </div>
      <MobileTabBar />
    </div>
  );
}
