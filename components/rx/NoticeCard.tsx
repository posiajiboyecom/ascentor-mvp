'use client';

// The Ascentor notice card: one inline card for an announcement or a message from the team, such as The Elevation Summit.
// It is the same card everywhere: at the top of Today, at the bottom of the right-hand column on desktop, and in the menu
// drawer on phones. Styling is the prototype's announcement card (rust at 7% over white, a 1px border, the soft shadow),
// in styles/rx.css.
//
//   <NoticeCard notice={{ id, source, title, line, href, actionLabel }} />
//
// Members cannot dismiss it. It is a marketing surface: only an admin takes it down, from Broadcasts, and that removes it
// for everyone. Pass `preview` to show it as a picture only (the admin broadcast screen does), and `compact` for narrow
// places.

import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import type { NoticeData } from '@/lib/rx/notice-types';

export interface NoticeCardProps {
  notice: NoticeData;
  compact?: boolean;
  /** A picture of the card for the admin screen: no links. */
  preview?: boolean;
}

export default function NoticeCard({ notice, compact, preview }: NoticeCardProps) {
  const body = (
    <>
      <span className="rx-strong" style={{ display: 'block', overflowWrap: 'anywhere' }}>{notice.title}</span>
      {notice.line && <span className="rx-sm" style={{ display: 'block', overflowWrap: 'anywhere' }}>{notice.line}</span>}
    </>
  );

  return (
    <div className="rx">
      <div className={`rx-annbar${compact ? ' compact' : ''} rx-rise`} role="region" aria-label={notice.source === 'announcement' ? 'Announcement' : 'Message from Ascentor'}>
        <span className="rx-dimdot" aria-hidden><Megaphone /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {notice.href && !preview
            ? <Link href={notice.href} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{body}</Link>
            : <div>{body}</div>}
          {notice.href && notice.actionLabel && (
            preview
              ? <span className="rx-link" style={{ minHeight: 32 }}>{notice.actionLabel}<ArrowRight aria-hidden /></span>
              : <Link href={notice.href} className="rx-link" style={{ minHeight: compact ? 32 : 36 }}>{notice.actionLabel}<ArrowRight aria-hidden /></Link>
          )}
        </div>
      </div>
    </div>
  );
}
