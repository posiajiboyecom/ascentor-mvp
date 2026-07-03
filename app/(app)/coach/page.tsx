// app/(app)/coach/page.tsx
// The AI Coach screen. Server Component — fetches session types,
// recent sessions, and this month's usage count, then hands off to
// the client CoachChat component for the interactive conversation.

import { redirect } from 'next/navigation';
import { getCoachPageData } from '@/lib/supabase/queries/coach';
import { CoachChat } from '@/components/coach/CoachChat';

function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function CoachPage() {
  const data = await getCoachPageData();
  if (!data) redirect('/login');

  return (
    <div className="relative h-full">
      <CoachChat
        firstName={data.firstName}
        greeting={getGreeting()}
        availableSessionTypes={data.availableSessionTypes}
        recentSessions={data.recentSessions}
        usedThisMonth={data.usedThisMonth}
        monthlyLimit={data.monthlyLimit}
      />
    </div>
  );
}
