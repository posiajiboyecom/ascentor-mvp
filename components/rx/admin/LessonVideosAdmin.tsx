'use client';

import { useState, useTransition } from 'react';
import { saveLessonVideo } from '@/app/admin/lesson-videos/actions';
import { parseVideoInput, youtubeThumb } from '@/lib/rx/video';
import VideoPlayer, { toSource } from '@/components/rx/learn/VideoPlayer';
import { useToast } from '@/components/rx/Toast';

export interface AdminLesson { id: string; slug: string; title: string; dimension: string; format: 'Video' | 'Reading'; video_url: string | null }

const RUST = 'var(--rx-rust, #B6502A)';

function Row({ lesson }: { lesson: AdminLesson }) {
  const toast = useToast();
  const [saved, setSaved] = useState(lesson.video_url ?? '');
  const [text, setText] = useState(lesson.video_url ?? '');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const checked = text.trim() ? parseVideoInput(text) : null;
  const dirty = text.trim() !== saved.trim();

  const save = () => {
    setError('');
    start(async () => {
      const r = await saveLessonVideo(lesson.id, text);
      if (!r.ok) { setError(r.error); return; }
      const next = r.stored ?? '';
      setSaved(next); setText(next);
      toast?.(next ? 'Video saved.' : 'Video removed.');
    });
  };

  return (
    <div className="rx-card rx-stack-sm" style={{ minWidth: 0 }}>
      <div className="rx-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="rx-strong" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{lesson.title}</span>
        <span className="rx-tag gold">{lesson.dimension}</span>
        <span className="rx-sm">{lesson.format}</span>
        {saved ? <span className="rx-sm">Video set</span> : lesson.format === 'Video' ? <span className="rx-sm" style={{ color: RUST }}>No video yet</span> : null}
      </div>
      <div className="rx-fld">
        <label htmlFor={`v-${lesson.id}`}>YouTube link</label>
        <input
          id={`v-${lesson.id}`} className="rx-in" value={text} inputMode="url" autoComplete="off" spellCheck={false}
          placeholder="https://www.youtube.com/watch?v=..." aria-invalid={checked ? !checked.ok : undefined}
          onChange={(e) => { setText(e.target.value); setError(''); }}
        />
        {checked && !checked.ok && <span className="rx-sm" role="alert" style={{ color: RUST }}>{checked.error}</span>}
        {checked?.ok && (
          <span className="rx-sm">
            Found a {checked.source.provider === 'youtube' ? 'YouTube' : checked.source.provider === 'vimeo' ? 'Vimeo' : 'video file'} video
            {checked.source.provider === 'youtube' ? ` (${checked.source.id})` : ''}.
          </span>
        )}
      </div>
      {checked?.ok && (
        <div className="rx-stack-sm">
          {open ? (
            <VideoPlayer {...toSource(checked.source)} title={`Preview: ${lesson.title}`} />
          ) : (
            <>
              {checked.source.provider === 'youtube' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={youtubeThumb(checked.source.id)} alt="" loading="lazy" style={{ width: '100%', maxWidth: 320, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div><button type="button" className="rx-btn secondary" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>Preview video</button></div>
            </>
          )}
        </div>
      )}
      {error && <p className="rx-sm" role="alert" style={{ color: RUST }}>{error}</p>}
      <div className="rx-row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="rx-btn primary" style={{ minHeight: 44 }} disabled={pending || !dirty || (!!checked && !checked.ok)} onClick={save}>{pending ? 'Saving…' : 'Save video'}</button>
        {saved && <button type="button" className="rx-link muted" style={{ minHeight: 44 }} disabled={pending} onClick={() => { setText(''); setOpen(false); }}>Clear</button>}
      </div>
    </div>
  );
}

export default function LessonVideosAdmin({ lessons }: { lessons: AdminLesson[] }) {
  return <div className="rx-stack" style={{ maxWidth: 760 }}>{lessons.map((l) => <Row key={l.id} lesson={l} />)}</div>;
}
