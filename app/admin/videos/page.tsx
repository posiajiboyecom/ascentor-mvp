'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Admin page
// app/admin/videos/page.tsx
//
// Shows all video jobs directly on the page with:
//   • Download button for completed videos
//   • Retry button for failed jobs
//   • Live status polling for in-flight jobs
//   • "Create new video" opens the VideoDrawer
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import VideoDrawer from '../content/VideoDrawer';

const MONO: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const AMBER       = '#A0720A';
const AMBER_BRIGHT = '#E8A020';
const DARK        = '#0C0B08';
const WARM        = '#F5F3EE';
const MUTED       = '#6B6860';
const FAINT       = '#9E9B94';
const BORDER      = '#E2DDD4';

interface VideoJob {
  id:                     string;
  status:                 'queued' | 'processing' | 'complete' | 'failed';
  goal:                   string;
  narrative_style:        string;
  theme:                  string;
  audio_mode:             string;
  scene_count:            number | null;
  total_duration_seconds: number | null;
  video_url:              string | null;
  error_message:          string | null;
  created_at:             string;
  completed_at:           string | null;
  duration_ms:            number | null;
  retry_count?:           number | null;
  used_preset?:           boolean | null;
  cost_usd_claude?:       number | null;
  cost_usd_elevenlabs?:   number | null;
  cost_usd_total?:        number | null;
  timings?:               Record<string, number> | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function StatusBadge({ status }: { status: VideoJob['status'] }) {
  const colors: Record<VideoJob['status'], { bg: string; fg: string }> = {
    complete:   { bg: 'rgba(16,185,129,0.12)',  fg: '#10B981' },
    failed:     { bg: 'rgba(239,68,68,0.10)',   fg: '#EF4444' },
    processing: { bg: 'rgba(232,160,32,0.12)',  fg: AMBER_BRIGHT },
    queued:     { bg: 'rgba(107,114,128,0.10)', fg: '#6B7280' },
  };
  const { bg, fg } = colors[status];
  return (
    <span style={{
      ...MONO, fontSize: 9, padding: '3px 9px', borderRadius: 999,
      background: bg, color: fg, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function DownloadButton({ url, jobId }: { url: string; jobId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `ascentor-video-${jobId.slice(0, 8)}.mp4`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // fallback — open in new tab
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      style={{
        ...MONO, fontSize: 10,
        padding: '5px 12px',
        borderRadius: 6,
        border: `1px solid ${AMBER}`,
        background: WARM,
        color: downloading ? FAINT : AMBER,
        cursor: downloading ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {downloading ? 'Downloading…' : '↓ Download'}
    </button>
  );
}

interface JobRowProps {
  job:         VideoJob;
  onRetry:     (id: string) => void;
  onDelete:    (id: string) => void;
  onCancel:    (id: string) => void;
  retrying:    boolean;
}

function JobRow({ job, onRetry, onDelete, onCancel, retrying }: JobRowProps) {
  const isInFlight = job.status === 'queued' || job.status === 'processing';
  const costTotal  = typeof job.cost_usd_total === 'number' ? job.cost_usd_total : null;
  const renderMs   = job.timings?.render_ms ?? null;

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      {/* Top row: goal + status + download */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: DARK, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.goal}
          </div>
          <div style={{ ...MONO, fontSize: 9, color: FAINT, display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
            <span>{job.narrative_style}</span>
            <span>{job.theme}</span>
            <span>{timeAgo(job.created_at)}</span>
            {job.scene_count ? <span>{job.scene_count} scenes</span> : null}
            {job.total_duration_seconds ? <span>{job.total_duration_seconds}s</span> : null}
            {typeof job.retry_count === 'number' && job.retry_count > 0
              ? <span>retried {job.retry_count}×</span> : null}
            {job.used_preset ? <span>preset</span> : null}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={job.status} />
          {job.video_url && (
            <DownloadButton url={job.video_url} jobId={job.id} />
          )}
          {job.video_url && (
            <a
              href={job.video_url}
              target="_blank"
              rel="noreferrer"
              style={{ ...MONO, fontSize: 10, color: MUTED, textDecoration: 'none' }}
            >
              ↗ View
            </a>
          )}
        </div>
      </div>

      {/* Cost + timing (complete jobs) */}
      {job.status === 'complete' && (costTotal !== null || renderMs !== null) && (
        <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 6, display: 'flex', gap: 10 }}>
          {costTotal !== null && <span>${Number(costTotal).toFixed(4)} total</span>}
          {typeof job.cost_usd_claude === 'number' && job.cost_usd_claude > 0
            && <span>claude ${Number(job.cost_usd_claude).toFixed(4)}</span>}
          {typeof job.cost_usd_elevenlabs === 'number' && job.cost_usd_elevenlabs > 0
            && <span>11L ${Number(job.cost_usd_elevenlabs).toFixed(4)}</span>}
          {renderMs !== null && <span>render {(renderMs / 1000).toFixed(1)}s</span>}
          {job.duration_ms && <span>total {(job.duration_ms / 1000).toFixed(1)}s</span>}
        </div>
      )}

      {/* In-flight progress indicator */}
      {isInFlight && (
        <div style={{ ...MONO, fontSize: 9, color: AMBER_BRIGHT, marginTop: 6 }}>
          <span style={{ display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite', marginRight: 4 }}>●</span>
          {job.status === 'queued' ? 'Waiting in queue…' : 'Rendering…'}
        </div>
      )}

      {/* Error message (failed jobs) */}
      {job.status === 'failed' && job.error_message && (
        <div style={{ ...MONO, fontSize: 9, color: '#EF4444', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.error_message}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
        {job.status === 'failed' && (
          <button
            onClick={() => onRetry(job.id)}
            disabled={retrying}
            style={{ ...MONO, fontSize: 9, color: AMBER_BRIGHT, background: 'none', border: 'none', cursor: retrying ? 'not-allowed' : 'pointer', padding: 0 }}
          >
            ↻ Retry
          </button>
        )}
        {isInFlight && (
          <button
            onClick={() => onCancel(job.id)}
            style={{ ...MONO, fontSize: 9, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ⨯ Cancel
          </button>
        )}
        {!isInFlight && (
          <button
            onClick={() => onDelete(job.id)}
            style={{ ...MONO, fontSize: 9, color: FAINT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function VideosAdminPage() {
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [jobs,        setJobs]        = useState<VideoJob[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [retryingId,  setRetryingId]  = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }, []);

  async function loadJobs() {
    try {
      const res  = await fetch('/api/admin/video/list');
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch { /* non-fatal */ }
    setLoading(false);
  }

  // Poll while any job is in-flight
  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const hasInFlight = jobs.some(j => j.status === 'queued' || j.status === 'processing');
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, 4000);
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobs]);

  async function handleRetry(jobId: string) {
    setRetryingId(jobId);
    try {
      const res  = await fetch(`/api/admin/video/retry?jobId=${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast('Retry failed: ' + (data.error ?? 'unknown'), false);
        return;
      }
      showToast('Retry queued — rendering again…');
      await loadJobs();
    } catch (e: any) {
      showToast('Retry error: ' + e.message, false);
    } finally {
      setRetryingId(null);
    }
  }

  async function handleCancel(jobId: string) {
    try {
      const res  = await fetch(`/api/admin/video/cancel?jobId=${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) { showToast('Cancel failed: ' + (data.error ?? 'unknown'), false); return; }
      showToast('Job cancelled.');
      await loadJobs();
    } catch (e: any) {
      showToast('Cancel error: ' + e.message, false);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm('Delete this video job?')) return;
    try {
      const res  = await fetch(`/api/admin/video/delete?jobId=${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { showToast('Delete failed: ' + (data.error ?? 'unknown'), false); return; }
      showToast('Deleted.');
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (e: any) {
      showToast('Delete error: ' + e.message, false);
    }
  }

  const inFlightJobs  = jobs.filter(j => j.status === 'queued' || j.status === 'processing');
  const completedJobs = jobs.filter(j => j.status === 'complete');
  const failedJobs    = jobs.filter(j => j.status === 'failed');

  return (
    <div style={{ minHeight: '100vh', background: WARM, padding: '40px 32px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Admin · Video Engine
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: DARK, margin: 0, marginBottom: 6 }}>
              Kinetic text videos
            </h1>
            <p style={{ ...MONO, fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.6 }}>
              Claude drafts the script · Remotion renders the MP4 · Supabase stores it
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              padding: '12px 24px', borderRadius: 8, border: 'none',
              background: DARK, color: '#fff', ...MONO,
              fontSize: 13, letterSpacing: '0.04em', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ▶  Create new video
          </button>
        </div>

        {/* In-flight */}
        {inFlightJobs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ ...MONO, fontSize: 10, color: AMBER_BRIGHT, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Rendering now
            </div>
            {inFlightJobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onCancel={handleCancel}
                retrying={retryingId === job.id}
              />
            ))}
          </div>
        )}

        {/* Failed */}
        {failedJobs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ ...MONO, fontSize: 10, color: '#EF4444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Failed
            </div>
            {failedJobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onCancel={handleCancel}
                retrying={retryingId === job.id}
              />
            ))}
          </div>
        )}

        {/* Completed */}
        <div>
          <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            {completedJobs.length > 0 ? `Completed (${completedJobs.length})` : 'Videos'}
          </div>
          {loading ? (
            <div style={{ ...MONO, fontSize: 11, color: FAINT }}>Loading…</div>
          ) : completedJobs.length === 0 && inFlightJobs.length === 0 && failedJobs.length === 0 ? (
            <div style={{ ...MONO, fontSize: 11, color: FAINT }}>
              No videos yet. Click "Create new video" to get started.
            </div>
          ) : (
            completedJobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onCancel={handleCancel}
                retrying={retryingId === job.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Drawer */}
      <VideoDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); loadJobs(); }}
        showToast={showToast}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? DARK : '#7C2D2D',
          color: '#fff', padding: '10px 18px', borderRadius: 8,
          ...MONO, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          zIndex: 300, maxWidth: '80%',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
