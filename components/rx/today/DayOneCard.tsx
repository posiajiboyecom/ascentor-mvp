'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

/** First-day checklist from the prototype: plan, say hello to the Circle, this week's lesson. */
export default function DayOneCard({ chatHref, lessonHref, lessonMeta }: { chatHref: string | null; lessonHref: string | null; lessonMeta: string }) {
  const num = (n: number, cur?: boolean) => <span className={`rx-pd${cur ? ' cur' : ''}`} style={{ width: 28, height: 28, fontSize: 13, fontWeight: 700 }}>{n}</span>;
  return (
    <div className="rx-card rx-stack rx-rise">
      <p className="rx-label">Day one · start here</p>
      <p className="rx-h3">Three small things to begin</p>
      <div style={{ marginTop: -6 }}>
        <button type="button" className="rx-rowlink" onClick={() => openSage({ topic: 'plan' })}>{num(1, true)}<span className="rt"><span className="t">Build your first plan</span><span className="m">One small practice for this week · about 3 minutes</span></span><ChevronRight aria-hidden /></button>
        {chatHref && <Link href={chatHref} className="rx-rowlink">{num(2)}<span className="rt"><span className="t">Say hello to your Circle</span><span className="m">Your name and one thing you’re working on</span></span><ChevronRight aria-hidden /></Link>}
        {lessonHref && <Link href={lessonHref} className="rx-rowlink">{num(chatHref ? 3 : 2)}<span className="rt"><span className="t">Watch this week’s lesson</span><span className="m">{lessonMeta}</span></span><ChevronRight aria-hidden /></Link>}
      </div>
    </div>
  );
}
