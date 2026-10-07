'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Megaphone } from 'lucide-react';
import { markAllAnnouncementsRead, markAnnouncementRead } from '@/app/(app)/announcements/actions';
import { useToast } from '@/components/rx/Toast';

export function MarkReadOnView({ id }: { id: string | null }) {
  const router = useRouter();
  useEffect(() => { if (id) { void markAnnouncementRead(id).then(() => router.refresh()); } }, [id, router]);
  return null;
}

export function MarkAllButton() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return <button type="button" className="rx-link" disabled={pending} onClick={() => start(async () => { await markAllAnnouncementsRead(); toast('All announcements marked as read.'); router.refresh(); })}>Mark all as read</button>;
}

export interface AnnItem { id: string; title: string; text: string; posted: string; isNew: boolean; ended: boolean }

export function AnnouncementList({ items }: { items: AnnItem[] }) {
  return (
    <div className="rx-card" style={{ padding: '4px 12px' }}>
      {items.map((a) => (
        <Link key={a.id} href={`/announcements?focus=${a.id}`} className="rx-rowlink">
          <span className="ri"><Megaphone aria-hidden /></span>
          <span className="rt"><span className="t">{a.title}</span><span className="m">{a.posted} · {a.ended ? 'Ended' : a.text}</span></span>
          {a.isNew && <span className="rx-newtag"><span className="rx-dot" />New</span>}
        </Link>
      ))}
    </div>
  );
}

export function Earlier({ items }: { items: AnnItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rx-stack-sm">
      <button type="button" className="rx-between" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, minHeight: 44, width: '100%', fontFamily: 'inherit' }}>
        <span className="rx-label">Earlier</span><span className="rx-sm">{open ? 'Hide' : items.length ? `Show ${items.length}` : 'None'}</span>
      </button>
      {open && (items.length ? <AnnouncementList items={items} /> : <p className="rx-sm">Nothing earlier.</p>)}
    </div>
  );
}

export function FocusCard({ label, title, text, when, location, btn, link, ended, image }: { label: string; title: string; text: string; when: string; location: string; btn: string; link: string; ended: boolean; image: string | null }) {
  const external = /^https?:\/\//i.test(link);
  return (
    <div className="rx-card rx-rise" style={{ padding: 0, overflow: 'hidden' }}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" style={{ width: '100%', aspectRatio: '21/8', objectFit: 'cover', display: 'block' }} />
      )}
      <div className="rx-stack-sm" style={{ padding: '20px 22px 22px' }}>
        <p className="rx-sm">{label}</p>
        <p className="rx-h2">{title}</p>
        {text && <p className="rx-p">{text}</p>}
        <div className="rx-stack-sm" style={{ margin: '6px 0' }}>
          {when && <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><CalendarDays aria-hidden style={{ width: 16, height: 16 }} />{when}</p>}
          {location && <p className="rx-row rx-nw rx-sm" style={{ gap: 8, alignItems: 'flex-start' }}><MapPin aria-hidden style={{ width: 16, height: 16, marginTop: 2 }} />{location}</p>}
        </div>
        {btn && link && !ended && (external
          ? <div><a href={link} target="_blank" rel="noopener noreferrer" className="rx-btn primary">{btn}</a></div>
          : <div><Link href={link} className="rx-btn primary">{btn}</Link></div>)}
      </div>
    </div>
  );
}
