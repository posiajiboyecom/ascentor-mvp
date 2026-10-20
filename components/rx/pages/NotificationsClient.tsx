'use client';

// Notification rows and the "Mark all as read" link. Reading happens on the server (page.tsx); these only write.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Bell } from 'lucide-react';
import { Avatar } from '@/components/rx/ui';
import { markAllNotificationsRead, markNotificationRead } from '@/app/(app)/notifications/actions';

export interface NotifRow { id: string; text: string; time: string; unread: boolean; href: string | null; actorName: string | null; actorId: string | null }

export function MarkAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="rx-link" disabled={pending} onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}>
      Mark all as read
    </button>
  );
}

export function NotifItem({ n }: { n: NotifRow }) {
  const router = useRouter();
  const [, start] = useTransition();
  const cls = `rx-rowlink${n.unread ? ' unread' : ''}`;
  const inner = (
    <>
      {n.actorName
        ? <Avatar name={n.actorName} seed={n.actorId} />
        : <span className="ri"><Bell aria-hidden /></span>}
      <span className="rt"><span className="t wrap">{n.text}</span><span className="m">{n.time}</span></span>
      {n.unread && <span className="rx-udot" role="img" aria-label="Unread" />}
    </>
  );
  const mark = () => { if (n.unread) start(async () => { await markNotificationRead(n.id); router.refresh(); }); };
  if (n.href) return <Link href={n.href} className={cls} onClick={mark}>{inner}</Link>;
  return <button type="button" className={cls} onClick={mark}>{inner}</button>;
}
