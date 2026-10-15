'use client';

// The Ascentor notice card: one inline card for an announcement or a message from the team, such as The Elevation Summit.
// It is the same card everywhere: at the top of Today, in the sidebar on desktop, and in the menu drawer on phones.
// Styling is the prototype's announcement card (rust at 7% over white, a 1px border, the soft shadow), in styles/rx.css.
//
//   <NoticeCard notice={{ id, source, title, line, href, actionLabel }} />
//
// A member can dismiss it. That is remembered in their own browser, per notice, so it does not nag. Pass `preview` to show it
// as a picture only (the admin broadcast screen does), and `compact` for the narrow sidebar.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Megaphone, X } from 'lucide-react';
import type { NoticeData } from '@/lib/rx/notice-types';

export interface NoticeCardProps {
  notice: NoticeData;
  compact?: boolean;
  /** A picture of the card for the admin screen: no links, no dismiss, nothing remembered. */
  preview?: boolean;
  /** Where the dismissal is remembered. Defaults to one key per notice. */
  storageKey?: string;
  onDismiss?: () => void;
}

export default function NoticeCard({ notice, compact, preview, storageKey, onDismiss }: NoticeCardProps) {
  const key = storageKey ?? `rx:notice-hidden:${notice.id}`;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (preview) return;
    try { if (localStorage.getItem(key)) setHidden(true); } catch { /* storage unavailable: show the card */ }
  }, [key, preview]);

  if (hidden) return null;

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
        {!preview && (
          <button type="button" className="rx-ib rx-annbar-x" aria-label={`Dismiss: ${notice.title}`}
            onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setHidden(true); onDismiss?.(); }}>
            <X aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
