import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import CallScreen from '@/components/rx/call/CallScreen';

export const dynamic = 'force-dynamic';

export default async function MentorSessionCall({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  if (!/^[0-9a-f-]{36}$/i.test(circleId)) notFound();

  // The session running now, or the next one.
  const { data: sessions } = await supabaseAdmin.from('circle_mentor_sessions').select('id, starts_at, duration_min').eq('circle_id', circleId).eq('status', 'scheduled').order('starts_at');
  const now = Date.now();
  const s = ((sessions ?? []) as { id: string; starts_at: string; duration_min: number }[]).find((x) => new Date(x.starts_at).getTime() + x.duration_min * 60000 > now);
  if (!s) return <div className="rx rx-call"><div className="rx-call-panel"><p className="rx-p">There’s no mentor session booked yet.</p><a href="/sessions" className="rx-btn secondary" style={{ marginTop: 16 }}>Back to Sessions</a></div></div>;

  return <CallScreen circleId={circleId} kind="mentor" sessionId={s.id} backHref="/sessions" firstName={me.firstName} />;
}
