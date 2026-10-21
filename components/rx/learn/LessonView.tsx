'use client';

// A lesson: watch or read, reflect, and turn it into this week's practice.

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Play } from 'lucide-react';
import { saveReflection, setLessonPractice } from '@/app/(app)/learn/lesson/actions';
import { IfThenFields, EMPTY_PLAN, type PlanData } from '@/components/rx/today/PlanCard';
import { openSage } from '@/components/rx/sage-bus';
import { useToast } from '@/components/rx/Toast';
import LessonVideo from '@/components/rx/learn/LessonVideo';
import { parseVideo } from '@/lib/rx/video';

export interface LessonViewProps {
  id: string; title: string; format: 'Video' | 'Reading'; videoUrl: string | null; body: string; minutes: number;
  watchPercent: number; watchPosition: number;
  reflection: string; practiceSet: boolean; startRead: boolean; draft: PlanData | null;
}

export default function LessonView(p: LessonViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [read, setRead] = useState(p.startRead || p.format === 'Reading');
  const [reflection, setReflection] = useState(p.reflection);
  const [draft, setDraft] = useState<PlanData>(p.draft ?? EMPTY_PLAN);
  const [done, setDone] = useState(p.practiceSet);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const video = parseVideo(p.videoUrl);

  // Sage can hand a drafted practice to this lesson.
  useEffect(() => {
    const apply = (d: Partial<PlanData>) => setDraft((cur) => ({ ...cur, ...d }));
    const onDraft = (e: Event) => { const d = (e as CustomEvent<Partial<PlanData>>).detail; if (d) apply(d); };
    window.addEventListener('rx:plan-draft', onDraft);
    return () => window.removeEventListener('rx:plan-draft', onDraft);
  }, []);

  function submit() {
    setError('');
    start(async () => {
      const r = await setLessonPractice(p.id, p.title, draft, reflection);
      if (!r.ok) { setError(r.error); return; }
      setDone(true);
      toast('Practice set. It’s on Today.');
      router.refresh();
    });
  }

  return (
    <div className="rx-two">
      <div className="rx-stack rx-rise">
        {p.format === 'Video' && (
          <div className="rx-row" style={{ gap: 8 }} role="group" aria-label="Lesson format">
            <button type="button" className="rx-chip" aria-pressed={!read} onClick={() => setRead(false)}>Watch</button>
            <button type="button" className="rx-chip" aria-pressed={read} onClick={() => setRead(true)}>Read instead</button>
          </div>
        )}

        {!read && p.format === 'Video' && (
          video ? (
            <LessonVideo key={p.id} lessonId={p.id} title={p.title} source={video} startSec={p.watchPosition} startPercent={p.watchPercent} />
          ) : (
            <div className="rx-video rx-rise"><div className="rx-stack-sm" style={{ alignItems: 'center', position: 'relative', padding: 16, textAlign: 'center' }}>
              <Play aria-hidden style={{ width: 36, height: 36 }} /><p className="rx-p rx-strong" style={{ color: '#fff' }}>The video for this lesson is coming soon.</p>
              <button type="button" className="rx-btn secondary" style={{ background: '#fff' }} onClick={() => setRead(true)}>Read it now</button>
            </div></div>
          )
        )}

        {(read || p.format === 'Reading') && (
          <div className="rx-card rx-stack rx-rise" style={{ fontSize: 17, lineHeight: 1.65 }}>
            {p.body.split(/\n{2,}/).map((para, i) => <p key={i} className="rx-p" style={{ fontSize: 17, lineHeight: 1.65 }}>{para}</p>)}
          </div>
        )}

        <div className="rx-card rx-stack-sm">
          <label htmlFor="refl" className="rx-h3">Which part of your day already happens without effort?</label>
          <textarea id="refl" className="rx-in" placeholder="A few words is enough" value={reflection} maxLength={2000}
            onChange={(e) => setReflection(e.target.value)} onBlur={() => { void saveReflection(p.id, reflection); }} />
        </div>
      </div>

      <div className="rx-stack">
        <div className="rx-card rx-stack">
          <div className="rx-between">
            <p className="rx-label">Your practice</p>
            <button type="button" className="rx-link" style={{ minHeight: 36 }} onClick={() => openSage({ topic: 'lesson' })}>Ask Sage<ArrowRight aria-hidden /></button>
          </div>
          <IfThenFields value={draft} onChange={setDraft} />
          <p className="rx-sm">The lesson counts once your practice is set.</p>
          {done && (
            <div className="rx-soft rx-row rx-nw rx-rise" style={{ gap: 10 }}>
              <Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />
              <span style={{ flex: 1 }}>Practice set. It’s on Today.</span>
              <Link href="/dashboard" className="rx-link">Today<ArrowRight aria-hidden /></Link>
            </div>
          )}
          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>
        <div className="rx-sticky-bottom"><button type="button" className="rx-btn primary block" disabled={pending} onClick={submit}>{pending ? 'Saving…' : done ? 'Update practice' : 'Set my practice'}</button></div>
      </div>
    </div>
  );
}
