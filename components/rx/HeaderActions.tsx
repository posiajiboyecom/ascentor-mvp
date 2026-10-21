'use client';

// Header controls for the member shell: announcements dropdown and the message inbox link.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bell, Megaphone, Mail } from 'lucide-react';
import { useNotifications } from '@/components/Notifications';
import { markAllAnnouncementsRead } from '@/app/(app)/announcements/actions';
import SageMark from '@/components/rx/SageMark';
import { openSage } from '@/components/rx/sage-bus';

export interface BellItem { id: string; title: string; posted: string; isNew: boolean }

export function AnnouncementsBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="rx" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" className="rx-ib" aria-label={unread ? `Announcements, ${unread} unread` : 'Announcements'}
        aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ position: 'relative' }}
      >
        <Megaphone aria-hidden />
        {unread > 0 && <span className="rx-dot" style={{ position: 'absolute', top: 10, right: 10 }} />}
      </button>
      {open && (
        <div className="rx-drop" role="dialog" aria-label="Latest announcements">
          <div className="rx-between" style={{ padding: '2px 4px 6px 6px' }}>
            <p className="rx-label">Announcements</p>
            {unread > 0 && (
              <button type="button" className="rx-link" style={{ minHeight: 32, fontSize: 13 }}
                onClick={() => start(async () => { await markAllAnnouncementsRead(); router.refresh(); })}>
                Mark all as read
              </button>
            )}
          </div>
          {items.map((a) => (
            <Link key={a.id} href={`/announcements?focus=${a.id}`} className="rx-rowlink" onClick={() => setOpen(false)} style={{ minHeight: 56, padding: '8px 6px' }}>
              <span className="ri"><Megaphone aria-hidden /></span>
              <span className="rt"><span className="t">{a.title}</span><span className="m">{a.posted}</span></span>
              {a.isNew && <span className="rx-newtag"><span className="rx-dot" />New</span>}
            </Link>
          ))}
          {items.length === 0 && <p className="rx-sm" style={{ padding: '12px 6px' }}>Nothing new right now.</p>}
          <div style={{ padding: '4px 6px 0' }}>
            <Link href="/announcements" className="rx-link" onClick={() => setOpen(false)}>See all<ArrowRight aria-hidden /></Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function MessagesLink({ requests, unread = 0 }: { requests: number; unread?: number }) {
  const parts = [unread ? `${unread} unread` : '', requests ? `${requests} message ${requests === 1 ? 'request' : 'requests'}` : ''].filter(Boolean);
  return (
    <div className="rx">
      <Link href="/messages" className="rx-ib" aria-label={parts.length ? `Messages, ${parts.join(', ')}` : 'Messages'} style={{ position: 'relative' }}>
        <Mail aria-hidden />
        {(requests > 0 || unread > 0) && <span className="rx-dot" style={{ position: 'absolute', top: 10, right: 10 }} />}
      </Link>
    </div>
  );
}

/** Desktop top-bar entry to Sage. On phones Sage is the floating button on Today and Learn. */
export function SageHeaderButton() {
  return (
    <div className="rx rx-dsk" style={{ alignItems: 'center' }}>
      <button type="button" className="rx-btn secondary" style={{ minHeight: 40, padding: '0 14px', gap: 8 }} onClick={() => openSage({ topic: 'plan' })}>
        <SageMark size={20} still />Sage
      </button>
    </div>
  );
}

/** The member's notifications (Circle and Community events). Reads the live list the app already keeps. */
export function NotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (id: string, link?: string) => { void markAsRead(id); setOpen(false); if (link) router.push(link); };

  return (
    <div className="rx" ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="rx-ib" aria-label={unreadCount ? 'Notifications, some unread' : 'Notifications'} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ position: 'relative' }}>
        <Bell aria-hidden />
        {unreadCount > 0 && <span className="rx-dot" style={{ position: 'absolute', top: 10, right: 10 }} />}
      </button>
      {open && (
        <div className="rx-drop" role="dialog" aria-label="Notifications" style={{ maxHeight: 440, overflowY: 'auto' }}>
          <div className="rx-between" style={{ padding: '2px 4px 6px 6px' }}>
            <p className="rx-label">Notifications</p>
            {unreadCount > 0 && <button type="button" className="rx-link" style={{ minHeight: 32, fontSize: 13 }} onClick={() => void markAllAsRead()}>Mark all as read</button>}
          </div>
          {notifications.slice(0, 20).map((n) => (
            <button key={n.id} type="button" className="rx-rowlink" onClick={() => go(n.id, n.link)} style={{ minHeight: 60, padding: '8px 6px', width: '100%', textAlign: 'left' }}>
              <span className="rt"><span className="t" style={{ whiteSpace: 'normal' }}>{n.title}</span><span className="m" style={{ whiteSpace: 'normal' }}>{n.message}</span></span>
              {!n.read && <span className="rx-newtag"><span className="rx-dot" />New</span>}
            </button>
          ))}
          {notifications.length === 0 && <p className="rx-sm" style={{ padding: '12px 6px' }}>Nothing yet. Circle and Community activity shows up here.</p>}
          <div className="rx-between" style={{ padding: '4px 6px 0' }}>
            <Link href="/notifications" className="rx-link" onClick={() => setOpen(false)}>See all<ArrowRight aria-hidden /></Link>
            <Link href="/settings" className="rx-link muted" style={{ fontSize: 13 }} onClick={() => setOpen(false)}>Settings</Link>
          </div>
        </div>
      )}
    </div>
  );
}
