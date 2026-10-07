'use client';

// Header controls for the member shell: announcements dropdown and the message inbox link.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Megaphone, Mail } from 'lucide-react';
import { markAllAnnouncementsRead } from '@/app/(app)/announcements/actions';

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

export function MessagesLink({ requests }: { requests: number }) {
  return (
    <div className="rx">
      <Link href="/messages" className="rx-ib" aria-label={requests ? `Messages, ${requests} message ${requests === 1 ? 'request' : 'requests'}` : 'Messages'} style={{ position: 'relative' }}>
        <Mail aria-hidden />
        {requests > 0 && <span className="rx-dot" style={{ position: 'absolute', top: 10, right: 10 }} />}
      </Link>
    </div>
  );
}
