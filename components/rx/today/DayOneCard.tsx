'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

const WORDS = ['', 'One small thing', 'Two small things', 'Three small things'];

/**
 * First-day checklist from the prototype: plan, say hello to the Circle, this week's lesson.
 * A member in a Circle who has not taken the confidentiality pledge yet gets "Take your Circle pledge" instead of the
 * chat step (the chat opens after the pledge). The title always matches the number of steps shown.
 */
export default function DayOneCard({ chatHref, pledgeHref, lessonHref, lessonMeta }: { chatHref: string | null; pledgeHref?: string | null; lessonHref: string | null; lessonMeta: string }) {
  const num = (n: number, cur?: boolean) => <span className={`rx-pd${cur ? ' cur' : ''}`} style={{ width: 28, height: 28, fontSize: 13, fontWeight: 700 }}>{n}</span>;
  const circleStep = chatHref
    ? { href: chatHref, t: 'Say hello to your Circle', m: 'Your name and one thing you’re working on' }
    : pledgeHref
    ? { href: pledgeHref, t: 'Take your Circle pledge', m: 'A short promise to keep what’s shared private. Then say hello.' }
    : null;
  const total = 1 + (circleStep ? 1 : 0) + (lessonHref ? 1 : 0);
  return (
    <div className="rx-card rx-stack rx-rise">
      <p className="rx-label">Day one · start here</p>
      <p className="rx-h3">{WORDS[total]} to begin</p>
      <div style={{ marginTop: -6 }}>
        <button type="button" className="rx-rowlink" onClick={() => openSage({ topic: 'plan' })}>{num(1, true)}<span className="rt"><span className="t">Build your first plan</span><span className="m">One small practice for this week · about 3 minutes</span></span><ChevronRight aria-hidden /></button>
        {circleStep && <Link href={circleStep.href} className="rx-rowlink">{num(2)}<span className="rt"><span className="t">{circleStep.t}</span><span className="m">{circleStep.m}</span></span><ChevronRight aria-hidden /></Link>}
        {lessonHref && <Link href={lessonHref} className="rx-rowlink">{num(circleStep ? 3 : 2)}<span className="rt"><span className="t">Watch this week’s lesson</span><span className="m">{lessonMeta}</span></span><ChevronRight aria-hidden /></Link>}
      </div>
    </div>
  );
}
