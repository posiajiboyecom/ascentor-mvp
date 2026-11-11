import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getPrivateSession } from '@/lib/rx/private-mentor';
import CallScreen from '@/components/rx/call/CallScreen';

export const dynamic = 'force-dynamic';

// Pinnacle private mentor session. The token route checks the caller is the member or the mentor; this page only
// sends each side back to the right place.
export default async function PrivateSessionCall({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const s = await getPrivateSession(sessionId);
  if (!s || (s.memberId !== me.userId && s.mentorUserId !== me.userId)) notFound();
  const back = s.memberId === me.userId ? '/sessions/private' : '/sessions/mentoring';
  return <CallScreen circleId={sessionId} kind="private" sessionId={sessionId} backHref={back} firstName={me.firstName} />;
}
