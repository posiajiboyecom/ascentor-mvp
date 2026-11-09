'use client';

// Explore lessons: dimension chips, sub-topic chips, and format / length filters.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, Play, BookOpen } from 'lucide-react';
import { INTEREST_GROUPS, DIMENSIONS } from '@/lib/rx/constants';

export interface LessonCard {
  slug: string; title: string; dimension: string; sub: string | null; minutes: number; format: 'Video' | 'Reading'; done: boolean; forYou: boolean;
  thumbnailUrl?: string | null;
}

const SUBS: Record<string, string[]> = {
  Mind: INTEREST_GROUPS[0].items, Character: INTEREST_GROUPS[1].items, Vocation: ['AI engineering', 'Cybersecurity', 'Entrepreneurship'],
  Relationships: INTEREST_GROUPS[4].items, Community: INTEREST_GROUPS[5].items, Legacy: INTEREST_GROUPS[6].items,
};

export default function LessonBrowser({ lessons }: { lessons: LessonCard[] }) {
  const [dim, setDim] = useState<string>('For you');
  const [sub, setSub] = useState('');
  const [fmt, setFmt] = useState<'' | 'Video' | 'Reading'>('');
  const [len, setLen] = useState<'' | 'short' | 'mid'>('');

  const list = useMemo(() => {
    let out = lessons.filter((l) =>
      (dim === 'For you' || l.dimension === dim) && (!sub || l.sub === sub) && (!fmt || l.format === fmt) &&
      (!len || (len === 'short' ? l.minutes < 10 : l.minutes >= 10 && l.minutes <= 20)));
    if (dim === 'For you') out = [...out].sort((a, b) => Number(b.forYou) - Number(a.forYou));
    return out;
  }, [lessons, dim, sub, fmt, len]);

  const title = dim === 'For you' ? 'For you' : dim + (sub ? ` · ${sub}` : '');
  const chips = ['For you', ...DIMENSIONS];

  return (
    <div className="rx-stack-lg">
      <div className="rx-stack-sm">
        <p className="rx-label">Explore</p>
        <div className="rx-row" style={{ gap: 8 }}>
          {chips.map((c) => (
            <button key={c} type="button" className="rx-chip" aria-pressed={dim === c} onClick={() => { setDim(c); setSub(''); }}>
              {dim === c && <Check aria-hidden />}{c}
            </button>
          ))}
        </div>
        {SUBS[dim]?.length ? (
          <div className="rx-row rx-rise" style={{ gap: 8, paddingLeft: 12, borderLeft: '2px solid var(--rx-border)' }}>
            {SUBS[dim].map((s) => (
              <button key={s} type="button" className="rx-chip" aria-pressed={sub === s} onClick={() => setSub(sub === s ? '' : s)}>{sub === s && <Check aria-hidden />}{s}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rx-row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <div className="rx-stack-sm">
          <p className="rx-label">Format</p>
          <div className="rx-row" style={{ gap: 8 }}>
            {(['Video', 'Reading'] as const).map((f) => <button key={f} type="button" className="rx-chip" aria-pressed={fmt === f} onClick={() => setFmt(fmt === f ? '' : f)}>{f}</button>)}
          </div>
        </div>
        <div className="rx-stack-sm">
          <p className="rx-label">Length</p>
          <div className="rx-row" style={{ gap: 8 }}>
            <button type="button" className="rx-chip" aria-pressed={len === 'short'} onClick={() => setLen(len === 'short' ? '' : 'short')}>Under 10 min</button>
            <button type="button" className="rx-chip" aria-pressed={len === 'mid'} onClick={() => setLen(len === 'mid' ? '' : 'mid')}>10 to 20 min</button>
          </div>
        </div>
      </div>

      <div className="rx-stack">
        <p className="rx-label">{title}</p>
        {list.length > 0 ? (
          <div className="rx-grid3">
            {list.map((l) => (
              <Link key={l.slug} href={`/learn/lesson/${l.slug}`} className="rx-lcard">
                <div className="rx-thumb">
                  {l.thumbnailUrl
                    ? <img src={l.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    : l.format === 'Video' ? <Play aria-hidden /> : <BookOpen aria-hidden />}
                </div>
                <div className="rx-stack-sm" style={{ gap: 4, minWidth: 0 }}>
                  <span className="rx-sm">{l.dimension}{l.sub ? ` · ${l.sub}` : ''}</span>
                  <span className="rx-h3" style={{ fontSize: 16 }}>{l.title}</span>
                  <span className="rx-sm">{l.minutes} min · {l.format}{l.done ? ' · Practice set' : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rx-card rx-empty">
            <p className="rx-p">No lessons here yet.</p>
            <button type="button" className="rx-btn secondary" onClick={() => { setDim('For you'); setSub(''); setFmt(''); setLen(''); }}>Show For you</button>
          </div>
        )}
      </div>
    </div>
  );
}
