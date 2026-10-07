import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { circleMessages } from '@/lib/rx/circle';
import { CircleChat } from '@/components/rx/circle/CircleClient';

export const dynamic = 'force-dynamic';

export default async function CircleChatPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle();
  if (!circle) redirect('/circle');
  if (!circle.pledged) redirect('/circle');
  const db = await createClient();
  const initial = await circleMessages(db, circle.circle.id);

  return (
    <div className="rx" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="rx-chat-head">
        <Link href="/circle" className="rx-ib" aria-label="Back to Circle"><ArrowLeft aria-hidden /></Link>
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
