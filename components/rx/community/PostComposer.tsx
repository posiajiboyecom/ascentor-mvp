'use client';

// "Share something" on the Community page, in two steps:
//   1. Write the post (rich text) and add photos or video if you want.
//   2. Choose a category, then post. The category is the last step before the post goes out.

import { useRef, useState, useTransition } from 'react';
import { ArrowLeft, Check, ImagePlus, X } from 'lucide-react';
import { createPost } from '@/app/(app)/community/actions';
import { POST_MEDIA_MAX, type CategoryView, type MediaItem } from '@/lib/rx/feed-types';
import { Avatar } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';
import dynamic from 'next/dynamic';
import { ACCEPT, uploadPostMedia } from './upload';
import '@/styles/rx-community.css';

// The editor is a large library and most visits only read the feed, so it is fetched when someone opens the composer.
const RichEditor = dynamic(() => import('./RichEditor'), {
  ssr: false,
  loading: () => <div className="rx-editor" aria-busy="true"><div className="rx-editor-body" /></div>,
});

interface Attachment { id: string; name: string; local: string; kind: 'image' | 'video'; item: MediaItem | null; error?: string }

export default function PostComposer({ categories, name, avatarUrl, userId, onPosted, defaultCategory }: {
  categories: CategoryView[]; name: string; avatarUrl: string | null; userId: string; onPosted: () => void; defaultCategory?: string | null;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'write' | 'category'>('write');
  const [category, setCategory] = useState<string | null>(defaultCategory ?? null);
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const uploading = files.some((f) => !f.item && !f.error);

  async function pick(list: FileList | null) {
    if (!list) return;
    const room = POST_MEDIA_MAX - files.length;
    if (room <= 0) { setError(`You can add up to ${POST_MEDIA_MAX} photos or videos.`); return; }
    setError('');
    for (const f of Array.from(list).slice(0, room)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const kind = f.type.startsWith('video/') ? 'video' : 'image';
      const att: Attachment = { id, name: f.name, local: URL.createObjectURL(f), kind, item: null };
      setFiles((cur) => [...cur, att]);
      uploadPostMedia(f)
        .then((item) => setFiles((cur) => cur.map((x) => (x.id === id ? { ...x, item } : x))))
        .catch((e: unknown) => setFiles((cur) => cur.map((x) => (x.id === id ? { ...x, error: e instanceof Error ? e.message : 'Upload failed.' } : x))));
    }
    if (input.current) input.current.value = '';
  }

  function next() {
    setError('');
    if (!text.trim()) { setError('Write something first.'); return; }
    if (uploading) { setError('Wait for your uploads to finish.'); return; }
    setStep('category');
  }

  function submit() {
    setError('');
    if (!category) { setError('Choose a category to post.'); return; }
    const media = files.map((f) => f.item).filter((m): m is MediaItem => !!m);
    start(async () => {
      const r = await createPost({ html, text, category, media });
      if (!r.ok) { setError(r.error); return; }
      toast('Posted to the community.');
      setHtml(''); setText(''); setFiles([]); setCategory(defaultCategory ?? null); setResetKey((k) => k + 1); setStep('write'); setOpen(false);
      onPosted();
    });
  }

  if (!open) {
    return (
      <button type="button" className="rx-launch" onClick={() => setOpen(true)}>
        <Avatar name={name} url={avatarUrl} seed={userId} />
        <span>Share something with the community</span>
      </button>
    );
  }

  return (
    <div className="rx-card rx-stack rx-rise">
      <div className="rx-between">
        <p className="rx-label">{step === 'write' ? 'New post' : 'Last step'}</p>
        <button type="button" className="rx-ib" aria-label="Close the composer" onClick={() => { setOpen(false); setStep('write'); }}><X aria-hidden /></button>
      </div>

      {/* The editor stays mounted on both steps so nothing is lost going back. */}
      <div hidden={step !== 'write'} className="rx-stack">
        <RichEditor placeholder="What would you like to share?" resetKey={resetKey} onChange={(h, t) => { setHtml(h); setText(t); }} />

        {files.length > 0 && (
          <div className="rx-attach">
            {files.map((f) => (
              <div key={f.id} className="thumb" title={f.error ?? f.name}>
                {f.kind === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.local} alt="" />
                  : <video src={f.local} muted playsInline />}
                {!f.item && !f.error && <span className="busy">Uploading</span>}
                {f.error && <span className="busy" style={{ color: 'var(--rx-danger)' }}>Failed</span>}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}><X aria-hidden /></button>
              </div>
            ))}
          </div>
        )}
        {files.some((f) => f.error) && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{files.find((f) => f.error)?.error}</p>}

        <div className="rx-between">
          <div>
            <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void pick(e.target.files)} />
            <button type="button" className="rx-btn secondary" style={{ gap: 8 }} onClick={() => input.current?.click()}><ImagePlus aria-hidden style={{ width: 18, height: 18 }} />Photo or video</button>
          </div>
          <button type="button" className="rx-btn primary" disabled={uploading} onClick={next}>Next</button>
        </div>
      </div>

      {step === 'category' && (
        <div className="rx-stack">
          <div className="rx-soft">
            <p className="rx-sm" style={{ marginBottom: 2 }}>Your post{files.length ? ` · ${files.length} ${files.length === 1 ? 'attachment' : 'attachments'}` : ''}</p>
            <p className="rx-p" style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</p>
          </div>
          <div className="rx-stack-sm">
            <p className="rx-p rx-strong" id="cat-label">What is it about?</p>
            <div className="rx-feed-chips" role="group" aria-labelledby="cat-label" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
              {categories.map((c) => (
                <button key={c.slug} type="button" className="rx-chip" aria-pressed={category === c.name} onClick={() => setCategory(c.name)}>{category === c.name && <Check aria-hidden />}{c.name}</button>
              ))}
            </div>
          </div>
          <div className="rx-between">
            <button type="button" className="rx-link muted" onClick={() => { setStep('write'); setError(''); }}><ArrowLeft aria-hidden style={{ transform: 'none' }} />Back</button>
            <button type="button" className="rx-btn primary" disabled={pending || !category} onClick={submit}>{pending ? 'Posting…' : 'Post'}</button>
          </div>
        </div>
      )}

      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}
