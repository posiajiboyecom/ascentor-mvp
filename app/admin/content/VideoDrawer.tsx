'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Video Drawer
// Drop in: app/admin/content/VideoDrawer.tsx
//
// Opens as a slide-in drawer from the Content page.
// Matches ContentInner.tsx styling exactly:
//   - DM Mono font
//   - #A0720A amber / #0C0B08 dark / #F5F3EE warm white palette
//   - Same pill button pattern as CarouselTab
//   - Same modal overlay pattern as runModal / pbModal
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';

// ── Types (inline so no extra import needed) ─────────────────
type VideoTheme      = 'dark' | 'light';
type AudioMode       = 'voiceover' | 'soundtrack' | 'none';
type NarrativeStyle  = 'authentic-story' | 'hard-truth' | 'contrast' | 'insight' | 'challenge' | 'journey';
type AudienceTier    = 'explorer' | 'builder' | 'climber' | 'founders';
type CTATemplate     =
  | 'dark-centered' | 'image-top' | 'split'
  | 'light-centered' | 'fullbg-branded' | 'minimal-link';

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
}

// ── Shared style helpers — match ContentInner exactly ────────
const MONO: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const AMBER = '#A0720A';
const AMBER_BRIGHT = '#E8A020';
const DARK  = '#0C0B08';
const WARM  = '#F5F3EE';
const MUTED = '#6B6860';
const FAINT = '#9E9B94';
const BORDER = '#E2DDD4';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
        fontSize: 12, ...MONO, textTransform: 'capitalize',
        border: `1px solid ${active ? AMBER : BORDER}`,
        background: active ? AMBER : WARM,
        color: active ? '#fff' : MUTED,
      }}
    >
      {children}
    </button>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 20 }}>{children}</div>;
}

// ── CTA template mini-previews ───────────────────────────────
const CTA_TEMPLATES: { id: CTATemplate; label: string; preview: React.ReactNode }[] = [
  {
    id: 'dark-centered', label: 'Dark centered',
    preview: (
      <div style={{ background: '#111', height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#ccc', ...MONO }}>Headline · subtitle</div>
        <div style={{ fontSize: 7, background: '#E8A020', color: '#111', padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>CTA Button</div>
      </div>
    ),
  },
  {
    id: 'image-top', label: 'Image + CTA',
    preview: (
      <div style={{ background: '#111', height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <div style={{ width: 28, height: 20, background: '#333', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8 }}>🖼</span>
        </div>
        <div style={{ fontSize: 7, color: '#aaa', ...MONO }}>Headline</div>
        <div style={{ fontSize: 7, background: '#E8A020', color: '#111', padding: '1px 7px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Register</div>
      </div>
    ),
  },
  {
    id: 'split', label: 'Split image',
    preview: (
      <div style={{ background: '#111', height: 64, borderRadius: 6, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <div style={{ flex: 1, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10 }}>🖼</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 6px', gap: 3 }}>
          <div style={{ fontSize: 7, color: '#ccc', ...MONO }}>Bold headline</div>
          <div style={{ fontSize: 7, background: '#E8A020', color: '#111', padding: '1px 5px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Go</div>
        </div>
      </div>
    ),
  },
  {
    id: 'light-centered', label: 'Light centered',
    preview: (
      <div style={{ background: '#fafaf5', height: 64, borderRadius: 6, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#333', ...MONO }}>Headline · subtitle</div>
        <div style={{ fontSize: 7, background: '#E8A020', color: '#111', padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>CTA Button</div>
      </div>
    ),
  },
  {
    id: 'fullbg-branded', label: 'Full branded',
    preview: (
      <div style={{ background: '#1a1a6e', height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#E8A020', ...MONO, fontWeight: 700 }}>Bold headline</div>
        <div style={{ fontSize: 7, background: '#fff', color: '#1a1a6e', padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Act now</div>
      </div>
    ),
  },
  {
    id: 'minimal-link', label: 'Minimal link',
    preview: (
      <div style={{ background: '#fafaf5', height: 64, borderRadius: 6, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px' }}>
        <div style={{ fontSize: 7, color: '#555', fontStyle: 'italic', ...MONO, textAlign: 'center' }}>"closing line from story"</div>
        <div style={{ fontSize: 7, color: '#185FA5', textDecoration: 'underline', ...MONO }}>ascentorbi.com</div>
      </div>
    ),
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
interface VideoDrawerProps {
  open:     boolean;
  onClose:  () => void;
  showToast: (msg: string, ok?: boolean) => void;
}

export default function VideoDrawer({ open, onClose, showToast }: VideoDrawerProps) {
  // ── Form state ───────────────────────────────────────────────
  const [goal,           setGoal]           = useState('');
  const [keyMessage,     setKeyMessage]     = useState('');
  const [style,          setStyle]          = useState<NarrativeStyle>('authentic-story');
  const [audience,       setAudience]       = useState<AudienceTier>('builder');
  const [theme,          setTheme]          = useState<VideoTheme>('dark');
  const [ctaTemplate,    setCtaTemplate]    = useState<CTATemplate>('dark-centered');
  const [ctaText,        setCtaText]        = useState('');
  const [ctaUrl,         setCtaUrl]         = useState('');
  const [ctaImageFile,   setCtaImageFile]   = useState<File | null>(null);
  const [ctaImagePreview,setCtaImagePreview]= useState<string | null>(null);
  const [audioMode,      setAudioMode]      = useState<AudioMode>('none');
  const [trackMood,      setTrackMood]      = useState('motivational');
  const [scheduleBuffer, setScheduleBuffer] = useState(false);

  // ── Job state ────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [activeJobId,  setActiveJobId]  = useState<string | null>(null);
  const [jobStatus,    setJobStatus]    = useState<VideoJob | null>(null);
  const [polling,      setPolling]      = useState(false);
  const pollRef                         = useRef<NodeJS.Timeout | null>(null);

  // ── Past jobs list ───────────────────────────────────────────
  const [pastJobs,     setPastJobs]     = useState<VideoJob[]>([]);
  const [loadingJobs,  setLoadingJobs]  = useState(false);

  // ── Load past jobs when drawer opens ─────────────────────────
  useEffect(() => {
    if (!open) return;
    loadPastJobs();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open]); // eslint-disable-line

  async function loadPastJobs() {
    setLoadingJobs(true);
    try {
      const res  = await fetch('/api/admin/video/list');
      const data = await res.json();
      if (data.jobs) setPastJobs(data.jobs);
    } catch {}
    setLoadingJobs(false);
  }

  // ── Polling for active job ────────────────────────────────────
  function startPolling(jobId: string) {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/admin/video/status?jobId=${jobId}`);
        const data = await res.json();
        setJobStatus(data);
        if (data.status === 'complete' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          setPolling(false);
          loadPastJobs();
          if (data.status === 'complete') {
            showToast(`Video ready — ${data.sceneCount} scenes · ${data.totalDurationSeconds}s`, true);
          } else {
            showToast('Video generation failed: ' + data.errorMessage, false);
          }
        }
      } catch {}
    }, 4000);
  }

  // ── Image upload handler ─────────────────────────────────────
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCtaImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCtaImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (!goal.trim() || !keyMessage.trim()) {
      showToast('Goal and key message are required', false);
      return;
    }
    if (!ctaText.trim() || !ctaUrl.trim()) {
      showToast('CTA button text and URL are required', false);
      return;
    }

    setSubmitting(true);
    try {
      // Convert image to base64 if provided
      let ctaImageBase64: string | undefined;
      let ctaImageMimeType: string | undefined;
      if (ctaImageFile) {
        const buf = await ctaImageFile.arrayBuffer();
        ctaImageBase64   = btoa(String.fromCharCode(...new Uint8Array(buf)));
        ctaImageMimeType = ctaImageFile.type;
      }

      const res = await fetch('/api/admin/video/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          formInput: {
            goal:            goal.trim(),
            keyMessage:      keyMessage.trim(),
            narrativeStyle:  style,
            audienceTier:    audience,
            theme,
            ctaTemplate,
            ctaButtonText:   ctaText.trim(),
            ctaButtonUrl:    ctaUrl.trim(),
            audioMode,
            trackMood:       audioMode === 'soundtrack' ? trackMood : undefined,
          },
          ctaImageBase64,
          ctaImageMimeType,
          scheduleToBuffer: scheduleBuffer,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        showToast('Error: ' + data.error, false);
        setSubmitting(false);
        return;
      }

      setActiveJobId(data.jobId);
      setJobStatus({ id: data.jobId, status: 'queued', goal, narrative_style: style, theme, audio_mode: audioMode, scene_count: null, total_duration_seconds: null, video_url: null, error_message: null, created_at: new Date().toISOString(), completed_at: null, duration_ms: null });
      startPolling(data.jobId);
      showToast(`Video queued — job ${data.jobId.slice(0, 8)}… (~2–4 min to render)`);

    } catch (err: any) {
      showToast('Error: ' + err.message, false);
    }
    setSubmitting(false);
  }

  function resetForm() {
    setGoal(''); setKeyMessage(''); setStyle('authentic-story');
    setAudience('builder'); setTheme('dark');
    setCtaTemplate('dark-centered'); setCtaText(''); setCtaUrl('');
    setCtaImageFile(null); setCtaImagePreview(null);
    setAudioMode('none'); setScheduleBuffer(false);
    setActiveJobId(null); setJobStatus(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  if (!open) return null;

  const needsImage = ctaTemplate === 'image-top' || ctaTemplate === 'split';

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(12,11,8,0.55)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 560,
        background: '#FDFCF9',
        borderLeft: `1px solid ${BORDER}`,
        zIndex: 201,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#FDFCF9', zIndex: 10,
        }}>
          <div>
            <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
              Video Engine · Kinetic Text
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: DARK }}>
              Create video
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ ...MONO, fontSize: 14, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* ── Active job status ──────────────────────────────── */}
        {jobStatus && (
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, background: jobStatus.status === 'complete' ? 'rgba(16,185,129,0.06)' : jobStatus.status === 'failed' ? 'rgba(239,68,68,0.06)' : 'rgba(232,160,32,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: jobStatus.status === 'complete' && jobStatus.video_url ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {polling && (
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: AMBER_BRIGHT, animation: 'pulse 1.2s ease-in-out infinite' }} />
                )}
                <span style={{ ...MONO, fontSize: 11, color: jobStatus.status === 'complete' ? '#10B981' : jobStatus.status === 'failed' ? '#EF4444' : AMBER_BRIGHT }}>
                  {jobStatus.status === 'queued'     && 'Queued — waiting for worker…'}
                  {jobStatus.status === 'processing' && 'Rendering your video…'}
                  {jobStatus.status === 'complete'   && `Done — ${jobStatus.scene_count} scenes · ${jobStatus.total_duration_seconds}s`}
                  {jobStatus.status === 'failed'     && 'Failed: ' + jobStatus.error_message}
                </span>
              </div>
              <button
                onClick={resetForm}
                style={{ ...MONO, fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                New video
              </button>
            </div>

            {/* Video player */}
            {jobStatus.status === 'complete' && jobStatus.video_url && (
              <div>
                <video
                  src={jobStatus.video_url}
                  controls
                  style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 340, background: '#000' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a
                    href={`/api/admin/video/download?jobId=${jobStatus.id}`}
                    download
                    style={{
                      ...MONO, fontSize: 10, padding: '6px 14px',
                      borderRadius: 6, border: `1px solid ${BORDER}`,
                      color: AMBER_BRIGHT, textDecoration: 'none', background: WARM
                    }}
                  >
                    ↓ Download MP4
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(jobStatus.video_url!); showToast('URL copied'); }}
                    style={{ ...MONO, fontSize: 10, padding: '6px 14px', borderRadius: 6, border: `1px solid ${BORDER}`, color: MUTED, background: WARM, cursor: 'pointer' }}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Form (hidden when job is active) ──────────────── */}
        {!activeJobId && (
          <div style={{ padding: '20px 24px', flex: 1 }}>

            {/* Goal */}
            <Section>
              <Label>Goal of this video</Label>
              <select
                value={goal}
                onChange={e => setGoal(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 13, ...MONO, color: DARK }}
              >
                <option value="">Select a goal…</option>
                <option>Invite people to an event</option>
                <option>Promote a product or service</option>
                <option>Build personal authority</option>
                <option>Drive sign-ups to Ascentor</option>
                <option>Share a leadership insight</option>
                <option>Announce something new</option>
              </select>
            </Section>

            {/* Key message */}
            <Section>
              <Label>Key message</Label>
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 6 }}>
                One sentence: what must the viewer feel and do?
              </div>
              <textarea
                value={keyMessage}
                onChange={e => setKeyMessage(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. Most African professionals are playing it safe when they should be building. I want them to register for our leadership summit."
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK, resize: 'vertical', lineHeight: 1.65 }}
              />
              <div style={{ ...MONO, fontSize: 9, color: FAINT, textAlign: 'right', marginTop: 2 }}>
                {keyMessage.length} / 300
              </div>
            </Section>

            {/* Narrative style */}
            <Section>
              <Label>Narrative style</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['authentic-story','hard-truth','contrast','insight','challenge','journey'] as NarrativeStyle[]).map(s => (
                  <Pill key={s} active={style === s} onClick={() => setStyle(s)}>
                    {s.replace('-', ' ')}
                  </Pill>
                ))}
              </div>
            </Section>

            {/* Audience */}
            <Section>
              <Label>Target audience</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['explorer','builder','climber','founders'] as AudienceTier[]).map(a => (
                  <Pill key={a} active={audience === a} onClick={() => setAudience(a)}>
                    {a === 'explorer' ? 'Early career' : a === 'builder' ? 'Mid-career' : a === 'climber' ? 'Senior / exec' : 'Founders'}
                  </Pill>
                ))}
              </div>
            </Section>

            {/* Theme */}
            <Section>
              <Label>Theme</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['dark','light'] as VideoTheme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${theme === t ? AMBER : BORDER}`,
                      background: t === 'dark' ? (theme === t ? '#1a1a1a' : '#111') : (theme === t ? '#fafaf5' : WARM),
                      color: t === 'dark' ? '#fff' : DARK,
                      ...MONO, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t === 'dark' ? '#333' : '#ddd', border: `1px solid ${t === 'dark' ? '#555' : '#bbb'}` }} />
                    {t === 'dark' ? 'Dark cinematic' : 'Light minimal'}
                  </button>
                ))}
              </div>
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 6 }}>
                {theme === 'dark' ? '↳ Dark logo (ascentor-logo-dark.png) will be used' : '↳ Light logo (ascentor-logo-light.png) will be used'}
              </div>
            </Section>

            {/* CTA templates */}
            <Section>
              <Label>CTA screen template</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                {CTA_TEMPLATES.map(tmpl => (
                  <div
                    key={tmpl.id}
                    onClick={() => setCtaTemplate(tmpl.id)}
                    style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${ctaTemplate === tmpl.id ? AMBER : BORDER}`, transition: 'border-color .15s' }}
                  >
                    {tmpl.preview}
                    <div style={{ ...MONO, fontSize: 9, color: ctaTemplate === tmpl.id ? AMBER : MUTED, textAlign: 'center', padding: '5px 4px', background: WARM }}>
                      {tmpl.label}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* CTA fields */}
            <Section>
              <Label>CTA button</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Button text"
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  style={{ padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK }}
                />
                <input
                  type="url"
                  placeholder="https://ascentorbi.com/…"
                  value={ctaUrl}
                  onChange={e => setCtaUrl(e.target.value)}
                  style={{ padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK }}
                />
              </div>
            </Section>

            {/* CTA image upload */}
            <Section>
              <Label>
                CTA image
                <span style={{ color: FAINT, fontWeight: 400, textTransform: 'none', fontSize: 9, marginLeft: 4 }}>
                  {needsImage ? '— required for this template' : '— optional'}
                </span>
              </Label>
              <div
                onClick={() => document.getElementById('cta-img-input')?.click()}
                style={{
                  border: `1px dashed ${needsImage && !ctaImageFile ? AMBER_BRIGHT : BORDER}`,
                  borderRadius: 8, padding: ctaImagePreview ? 0 : '18px 12px',
                  textAlign: 'center', cursor: 'pointer', background: WARM, overflow: 'hidden',
                }}
              >
                {ctaImagePreview ? (
                  <img src={ctaImagePreview} alt="CTA preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>↑</div>
                    <div style={{ ...MONO, fontSize: 10, color: MUTED }}>
                      {needsImage ? 'Upload required — event banner, book cover, headshot' : 'Upload image — event banner, book cover, headshot'}
                    </div>
                    <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 4 }}>PNG, JPG — max 5MB</div>
                  </>
                )}
                <input id="cta-img-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
              </div>
              {ctaImagePreview && (
                <button
                  onClick={() => { setCtaImageFile(null); setCtaImagePreview(null); }}
                  style={{ ...MONO, fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', marginTop: 6 }}
                >
                  ✕ Remove image
                </button>
              )}
            </Section>

            {/* Audio */}
            <Section>
              <Label>Audio</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { id: 'voiceover', label: 'Voiceover', sub: 'ElevenLabs AI' },
                  { id: 'soundtrack', label: 'Soundtrack', sub: 'From library' },
                  { id: 'none', label: 'No audio', sub: 'Silent' },
                ] as { id: AudioMode; label: string; sub: string }[]).map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAudioMode(a.id)}
                    style={{
                      padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${audioMode === a.id ? AMBER : BORDER}`,
                      background: audioMode === a.id ? 'rgba(160,114,10,0.06)' : WARM,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ ...MONO, fontSize: 11, color: audioMode === a.id ? AMBER : DARK, marginBottom: 2 }}>{a.label}</div>
                    <div style={{ ...MONO, fontSize: 9, color: FAINT }}>{a.sub}</div>
                  </button>
                ))}
              </div>

              {audioMode === 'soundtrack' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 6 }}>Track mood</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['motivational','reflective','uplifting','bold','ambient'].map(m => (
                      <Pill key={m} active={trackMood === m} onClick={() => setTrackMood(m)}>{m}</Pill>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Buffer toggle */}
            <Section>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scheduleBuffer}
                  onChange={e => setScheduleBuffer(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: AMBER }}
                />
                <span style={{ ...MONO, fontSize: 11, color: MUTED }}>
                  Queue to Buffer (LinkedIn) when complete
                </span>
              </label>
            </Section>

            {/* Cost estimate */}
            <div style={{ background: WARM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 10, color: MUTED }}>Estimated cost</span>
              <span style={{ ...MONO, fontSize: 11, color: DARK }}>
                ~$0.01–0.02 Claude
                {audioMode === 'voiceover' && ' + ~$0.10 ElevenLabs'}
              </span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? '#9E9B94' : DARK,
                color: '#fff', fontSize: 13, ...MONO, letterSpacing: '0.04em',
              }}
            >
              {submitting ? 'Submitting…' : '▶  Generate video'}
            </button>
          </div>
        )}

        {/* ── Past jobs list ─────────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 24px' }}>
          <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Recent videos
          </div>
          {loadingJobs ? (
            <div style={{ ...MONO, fontSize: 10, color: FAINT }}>Loading…</div>
          ) : pastJobs.length === 0 ? (
            <div style={{ ...MONO, fontSize: 10, color: FAINT }}>No videos yet.</div>
          ) : pastJobs.slice(0, 8).map(job => (
            <div
              key={job.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: DARK, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.goal}
                </div>
                <div style={{ ...MONO, fontSize: 9, color: FAINT }}>
                  {job.narrative_style} · {job.theme} · {timeAgo(job.created_at)}
                  {job.scene_count ? ` · ${job.scene_count} scenes` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                <span style={{
                  ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 999,
                  background:
                    job.status === 'complete'   ? 'rgba(16,185,129,0.12)' :
                    job.status === 'failed'     ? 'rgba(239,68,68,0.10)'  :
                    job.status === 'processing' ? 'rgba(232,160,32,0.12)' :
                    'rgba(107,114,128,0.10)',
                  color:
                    job.status === 'complete'   ? '#10B981' :
                    job.status === 'failed'     ? '#EF4444' :
                    job.status === 'processing' ? AMBER_BRIGHT :
                    '#6B7280',
                }}>
                  {job.status}
                </span>
                {job.video_url && (
                  <a
                    href={job.video_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...MONO, fontSize: 9, color: AMBER_BRIGHT, textDecoration: 'none' }}
                  >
                    ↗ View
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
