'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Circle as CircleIcon } from 'lucide-react';

export interface MoreRow { title: string; meta: string; href: string }

/** Collapsible list on mobile. On desktop the page shows the same rows in its side column instead. */
export default function MoreForToday({ rows }: { rows: MoreRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rx-stack-sm">
      <button type="button" className="rx-between" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, minHeight: 44, width: '100%', fontFamily: 'inherit' }}>
        <span className="rx-label">More for today</span><span className="rx-sm">{open ? 'Hide' : `Show ${rows.length}`}</span>
      </button>
      {open && (
        <div className="rx-card rx-rise" style={{ padding: '4px 16px' }}>
          {rows.map((r) => (
            <Link key={r.href + r.title} href={r.href} className="rx-rowlink">
              <span className="ri"><CircleIcon aria-hidden /></span>
              <span className="rt"><span className="t">{r.title}</span><span className="m">{r.meta}</span></span>
              <ChevronRight aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
