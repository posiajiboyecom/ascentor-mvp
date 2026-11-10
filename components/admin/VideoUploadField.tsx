'use client';

// components/admin/VideoUploadField.tsx
// Admin form field: upload a video to Ascentor's own storage (Cloudflare
// R2) or pick one already uploaded. The file goes straight from the
// browser to R2 via a presigned URL, then a background job converts it
// to adaptive HLS. The field reports the chosen video id via onChange
// as soon as the upload starts, so the course can be saved while the
// video is still processing.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AdminVideo {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  hls_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  error: string | null;
  created_at: string;
}

const T = {
  ui: 'var(--ledger-font-ui)',
  mono: 'var(--ledger-font-mono)',
  ink: 'var(--ledger-ink)',
  soft: 'var(--ledger-ink-soft)',
  faint: 'var(--ledger-ink-faint)',
  card: 'var(--ledger-bg-card)',
  input: 'var(--ledger-bg-input)',
  line: 'var(--ledger-line)',
  gold: 'var(--ledger-gold)',
  goldBg: 'var(--ledger-gold-bg)',
  good: 'var(--ledger-good)',
  bad: 'var(--ledger-bad)',
};

function fmtDuration(s: number | null) {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<AdminVideo['status'], string> = {
  uploading: 'Uploading',
  processing: 'Processing (usually a few minutes)',
  ready: 'Ready',
  failed: 'Failed',
};

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload. Check the R2 CORS policy.'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    signal.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

export function VideoUploadField({
  value,
  onChange,
  defaultTitle,
}: {
  value: string | null;
  onChange: (videoId: string | null) => void;
  defaultTitle?: string;
}) {
  const [video, setVideo] = useState<AdminVideo | null>(null);
  const [library, setLibrary] = useState<AdminVideo[] | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadVideo = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/videos/${id}`);
    if (!res.ok) return setVideo(null);
    const { video } = await res.json();
    setVideo(video);
  }, []);

  // Load the selected video, and poll while it is still processing
  useEffect(() => {
    if (!value) return setVideo(null);
    loadVideo(value);
  }, [value, loadVideo]);

  useEffect(() => {
    if (!value || !video || (video.status !== 'processing' && video.status !== 'uploading') || progress !== null) return;
    const t = setInterval(() => loadVideo(value), 5000);
    return () => clearInterval(t);
  }, [value, video, progress, loadVideo]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function openLibrary() {
    setShowLibrary((s) => !s);
    if (library) return;
    const res = await fetch('/api/admin/videos');
    const json = await res.json();
    setLibrary(json.videos ?? []);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const create = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: defaultTitle || file.name.replace(/\.[^.]+$/, ''),
          contentType: file.type,
          size: file.size,
        }),
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error || 'Could not start upload');

      onChange(created.videoId);
      setProgress(0);
      abortRef.current = new AbortController();
      await uploadWithProgress(created.uploadUrl, file, setProgress, abortRef.current.signal);

      const done = await fetch(`/api/admin/videos/${created.videoId}/complete`, { method: 'POST' });
      const doneJson = await done.json();
      if (!done.ok) throw new Error(doneJson.error || 'Could not start processing');

      setProgress(null);
      setLibrary(null);
      await loadVideo(created.videoId);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const statusColor = video?.status === 'ready' ? T.good : video?.status === 'failed' ? T.bad : T.gold;

  return (
    <div style={{ fontFamily: T.ui }}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {video || progress !== null ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: `1px solid ${T.line}`, borderRadius: 10, background: T.card }}>
          <div style={{ width: 128, aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', background: '#0F0F0E', flexShrink: 0 }}>
            {video?.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: T.ink, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {video?.title ?? 'Uploading…'}
            </div>
            {progress !== null ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, borderRadius: 2, background: T.input, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: T.gold, transition: 'width .2s' }} />
                </div>
                <div style={{ marginTop: 4, fontFamily: T.mono, fontSize: 11, color: T.soft }}>Uploading {progress}%</div>
              </div>
            ) : video ? (
              <div style={{ marginTop: 4, fontFamily: T.mono, fontSize: 11, color: statusColor }}>
                {STATUS_LABEL[video.status]}
                {video.duration_seconds ? ` · ${fmtDuration(video.duration_seconds)}` : ''}
                {video.status === 'failed' && video.error ? ` · ${video.error.slice(0, 120)}` : ''}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {progress !== null ? (
              <button type="button" onClick={() => abortRef.current?.abort()} style={btn()}>Cancel</button>
            ) : (
              <>
                <button type="button" onClick={() => inputRef.current?.click()} style={btn()}>Replace</button>
                <button type="button" onClick={() => onChange(null)} style={btn()}>Remove</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={btn(true)}>Upload video</button>
          <button type="button" onClick={openLibrary} style={btn()}>Choose from library</button>
        </div>
      )}

      {error && <div style={{ marginTop: 8, fontSize: 12, color: T.bad }}>{error}</div>}

      {showLibrary && !video && progress === null && (
        <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto', border: `1px solid ${T.line}`, borderRadius: 10 }}>
          {library === null ? (
            <div style={{ padding: 12, fontSize: 12, color: T.soft }}>Loading…</div>
          ) : library.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: T.soft }}>No videos uploaded yet.</div>
          ) : (
            library.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { onChange(v.id); setShowLibrary(false); }}
                style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.line}`, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ color: T.ink, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: v.status === 'ready' ? T.good : v.status === 'failed' ? T.bad : T.gold }}>
                  {v.status}{v.duration_seconds ? ` · ${fmtDuration(v.duration_seconds)}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 11, color: T.faint }}>
        MP4, MOV or WebM, up to 5 GB. Converted to 360p, 540p and 720p for smooth playback on any connection.
      </div>
    </div>
  );
}

function btn(primary = false): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 8,
    border: `1px solid ${primary ? T.gold : T.line}`,
    background: primary ? T.goldBg : 'transparent',
    color: primary ? T.gold : T.ink,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.ui,
  };
}
