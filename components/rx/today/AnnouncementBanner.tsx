'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Megaphone, X } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';

export default function AnnouncementBanner({ id, title, line, btn }: { id: string; title: string; line: string; btn: string }) {
  const toast = useToast();
  const key = `rx:ann-hidden:${id}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { if (localStorage.getItem(key)) setHidden(true); } catch { /* storage unavailable */ } }, [key]);
  if (hidden) return null;
  return (
    <div className="rx-annbar rx-rise" role="region" aria-label="Announcement">
      <span className="rx-dimdot"><Megaphone aria-hidden /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/announcements?focus=${id}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <span className="rx-strong" style={{ display: 'block' }}>{title}</span>
          <span className="rx-sm" style={{ display: 'block' }}>{line}</span>
        </Link>
        <Link href={`/announcements?focus=${id}`} className="rx-link" style={{ minHeight: 36 }}>{btn}<ArrowRight aria-hidden /></Link>
      </div>
      <button type="button" className="rx-ib" aria-label="Dismiss announcement" onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setHidden(true); toast('Hidden from Today. It’s still in your menu.'); }}><X aria-hidden /></button>
    </div>
  );
}
