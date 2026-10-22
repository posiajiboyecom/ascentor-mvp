import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { circleMessages } from '@/lib/rx/circle';
import { featureBlock } from '@/lib/access';
import { CircleChat } from '@/components/rx/circle/CircleClient';

export const dynamic = 'force-dynamic';

export default async function CircleChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle('member', c);
  if (!circle) redirect('/circle');
  if (!circle.pledged) redirect('/circle');
  // Billing v2: Circle chat pauses on light access. Today, the growth record, open house and direct messages stay open.
  const paused = await featureBlock(me.userId, 'circleChat');
  if (paused) {
    return (
      <div className="rx" style={{ padding: 24 }}>
        <div className="rx-card rx-stack-sm" style={{ maxWidth: 520 }}>
          <p className="rx-h3">Circle chat is paused</p>
          <p className="rx-p">{paused}</p>
          <Link href="/settings/billing" className="rx-btn primary">Reactivate</Link>
          <Link href="/messages" className="rx-sm">Direct messages are still open</Link>
        </div>
      </div>
    );
  }
  const db = await createClient();
  const initial = await circleMessages(db, circle.circle.id);

  return (
    <div className="rx" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="rx-chat-head">
        <Link href={`/circle?c=${circle.circle.id}`} className="rx-ib" aria-label="Back to Circle"><ArrowLeft aria-hidden /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="rx-h3">Circle chat</p>
          <p className="rx-sm">{circle.memberCount} members · private</p>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CircleChat circleId={circle.circle.id} meId={me.userId} initial={initial} />
      </div>
    </div>
  );
}
