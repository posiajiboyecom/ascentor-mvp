'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — VideoDrawer (Phase 3 patched)
// Drop in: app/admin/content/VideoDrawer.tsx
//
// Phase 3 adds a two-stage flow:
//
//   Stage 1: Form   → click "Preview script" → /api/admin/video/preview
//                     (runs Claude only, ~5–12s, ~$0.01–0.02)
//
//   Stage 2: Preview → inline editor for every scene/line, CTA copy,
//                     and voiceover script.
//                     "Regenerate" → new Claude call with same form inputs
//                     "Render this" → /api/admin/video/generate with
//                     presetStory populated → Trigger task skips Claude
//
// All Phase 1 + Phase 2 fixes preserved.
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────
type VideoTheme      = 'dark' | 'light';
type AudioMode       = 'voiceover' | 'soundtrack' | 'none';
type NarrativeStyle  = 'authentic-story' | 'hard-truth' | 'contrast' | 'insight' | 'challenge' | 'journey';
type AudienceTier    = 'explorer' | 'builder' | 'climber' | 'founders';
type CTATemplate     =
  | 'dark-centered' | 'image-top' | 'split'
  | 'light-centered' | 'fullbg-branded' | 'minimal-link';
type SceneEmphasis   = 'normal' | 'bold' | 'accent' | 'whisper';
type SceneAnimation  = 'fade-up' | 'fade-in' | 'word-by-word' | 'slide-left';

interface SceneLine {
  text:      string;
  emphasis:  SceneEmphasis;
  delayMs:   number;
}

interface NarrativeScene {
  id:               string;
  lines:            SceneLine[];
  durationSeconds:  number;
  animation:        SceneAnimation;
}

interface StoryEngineResponse {
  scenes:               NarrativeScene[];
  ctaHeadline:          string;
  ctaSubtitle:          string;
  closingLine:          string;
  voiceoverScript:      string;
  totalDurationSeconds: number;
}

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
  // ── Phase 4+5 additions ────────────────────────────────────
  retry_count?:           number | null;
  deleted_at?:            string | null;
  used_preset?:           boolean | null;
  cost_usd_claude?:       number | null;
  cost_usd_elevenlabs?:   number | null;
  cost_usd_total?:        number | null;
  timings?:               Record<string, number> | null;
}

// ── Shared style helpers ─────────────────────────────────────
const MONO: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const AMBER = '#A0720A';
const AMBER_BRIGHT = '#E8A020';
const DARK  = '#0C0B08';
const WARM  = '#F5F3EE';
const MUTED = '#6B6860';
const FAINT = '#9E9B94';
const BORDER = '#E2DDD4';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_KEY_MESSAGE_CHARS = 300;
const MAX_CTA_BUTTON_CHARS = 32;
const MAX_LINE_CHARS = 180;
const CTA_DURATION_SECONDS = 8;

// Emphasis + animation options (used by scene editor)
const EMPHASIS_OPTIONS: SceneEmphasis[]   = ['normal', 'bold', 'accent', 'whisper'];
const ANIMATION_OPTIONS: SceneAnimation[] = ['fade-up', 'fade-in', 'word-by-word', 'slide-left'];

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '3px 8px' : '6px 14px',
        borderRadius: 6, cursor: 'pointer',
        fontSize: small ? 10 : 12, ...MONO,
        textTransform: 'capitalize',
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

// ── CTA previews (theme-aware, from Phase 2) ─────────────────
function makeCtaPreviews(theme: VideoTheme) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#111' : '#fafaf5';
  const borderStyle = isDark ? 'none' : `1px solid ${BORDER}`;
  const textColor = isDark ? '#ccc' : '#333';
  const mutedTextColor = isDark ? '#aaa' : '#555';
  const btnBg = isDark ? AMBER_BRIGHT : AMBER;
  const btnFg = isDark ? '#111' : '#fff';
  const imgPlaceholder = isDark ? '#333' : '#e6e1d7';
  const splitImageBg = isDark ? '#222' : '#ebe6dc';
  const linkColor = isDark ? '#E8C47A' : '#185FA5';
  const fullBrandedBg = '#1a1a6e';

  return [
    { id: 'dark-centered' as CTATemplate, label: 'Dark centered', preview: (
      <div style={{ background: '#111', height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#ccc', ...MONO }}>Headline · subtitle</div>
        <div style={{ fontSize: 7, background: AMBER_BRIGHT, color: '#111', padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>CTA Button</div>
      </div>
    )},
    { id: 'image-top' as CTATemplate, label: 'Image + CTA', preview: (
      <div style={{ background: bg, border: borderStyle, height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <div style={{ width: 28, height: 20, background: imgPlaceholder, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 8 }}>🖼</span></div>
        <div style={{ fontSize: 7, color: mutedTextColor, ...MONO }}>Headline</div>
        <div style={{ fontSize: 7, background: btnBg, color: btnFg, padding: '1px 7px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Register</div>
      </div>
    )},
    { id: 'split' as CTATemplate, label: 'Split image', preview: (
      <div style={{ background: bg, border: borderStyle, height: 64, borderRadius: 6, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <div style={{ flex: 1, background: splitImageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10 }}>🖼</span></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 6px', gap: 3 }}>
          <div style={{ fontSize: 7, color: textColor, ...MONO }}>Bold headline</div>
          <div style={{ fontSize: 7, background: btnBg, color: btnFg, padding: '1px 5px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Go</div>
        </div>
      </div>
    )},
    { id: 'light-centered' as CTATemplate, label: 'Light centered', preview: (
      <div style={{ background: '#fafaf5', height: 64, borderRadius: 6, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#333', ...MONO }}>Headline · subtitle</div>
        <div style={{ fontSize: 7, background: AMBER, color: '#fff', padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>CTA Button</div>
      </div>
    )},
    { id: 'fullbg-branded' as CTATemplate, label: 'Full branded', preview: (
      <div style={{ background: fullBrandedBg, height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: AMBER_BRIGHT, ...MONO, fontWeight: 700 }}>Bold headline</div>
        <div style={{ fontSize: 7, background: '#fff', color: fullBrandedBg, padding: '2px 8px', borderRadius: 3, ...MONO, fontWeight: 700 }}>Act now</div>
      </div>
    )},
    { id: 'minimal-link' as CTATemplate, label: 'Minimal link', preview: (
      <div style={{ background: bg, border: borderStyle, height: 64, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px' }}>
        <div style={{ fontSize: 7, color: mutedTextColor, fontStyle: 'italic', ...MONO, textAlign: 'center' }}>"closing line from story"</div>
        <div style={{ fontSize: 7, color: linkColor, textDecoration: 'underline', ...MONO }}>ascentorbi.com</div>
      </div>
    )},
  ];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx === -1 ? result : result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════════
// SCENE EDITOR — nested components for the preview stage
// ══════════════════════════════════════════════════════════════

interface LineEditorProps {
  line:      SceneLine;
  onChange:  (line: SceneLine) => void;
  onDelete:  () => void;
  canDelete: boolean;
}

function LineEditor({ line, onChange, onDelete, canDelete }: LineEditorProps) {
  return (
    <div style={{
      background: WARM,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    }}>
      <textarea
        value={line.text}
        onChange={e => onChange({ ...line, text: e.target.value.slice(0, MAX_LINE_CHARS) })}
        rows={2}
        placeholder="Line text…"
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          background: '#fff',
          fontSize: 12,
          ...MONO,
          color: DARK,
          resize: 'vertical',
          lineHeight: 1.5,
          marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Emphasis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ ...MONO, fontSize: 9, color: FAINT, marginRight: 2 }}>Emphasis:</span>
          {EMPHASIS_OPTIONS.map(e => (
            <Pill key={e} small active={line.emphasis === e} onClick={() => onChange({ ...line, emphasis: e })}>
              {e}
            </Pill>
          ))}
        </div>
        {/* Delay */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...MONO, fontSize: 9, color: FAINT }}>Delay</span>
          <input
            type="number"
            min={0}
            max={3000}
            step={100}
            value={line.delayMs}
            onChange={e => onChange({ ...line, delayMs: Math.max(0, Math.min(3000, parseInt(e.target.value || '0', 10))) })}
            style={{
              width: 64, padding: '3px 6px',
              border: `1px solid ${BORDER}`, borderRadius: 4,
              background: '#fff', fontSize: 10, ...MONO, color: DARK,
            }}
          />
          <span style={{ ...MONO, fontSize: 9, color: FAINT }}>ms</span>
        </div>
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        {/* Delete */}
        {canDelete && (
          <button
            onClick={onDelete}
            style={{ ...MONO, fontSize: 10, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕ Delete line
          </button>
        )}
        {/* Char counter */}
        <span style={{ ...MONO, fontSize: 9, color: FAINT }}>{line.text.length}/{MAX_LINE_CHARS}</span>
      </div>
    </div>
  );
}

interface SceneEditorProps {
  scene:           NarrativeScene;
  index:           number;
  total:           number;
  onChange:        (scene: NarrativeScene) => void;
  onDelete:        () => void;
  onMoveUp:        () => void;
  onMoveDown:      () => void;
}

function SceneEditor({ scene, index, total, onChange, onDelete, onMoveUp, onMoveDown }: SceneEditorProps) {
  function updateLine(lineIdx: number, updated: SceneLine) {
    const lines = scene.lines.map((l, i) => i === lineIdx ? updated : l);
    onChange({ ...scene, lines });
  }
  function deleteLine(lineIdx: number) {
    const lines = scene.lines.filter((_, i) => i !== lineIdx);
    onChange({ ...scene, lines });
  }
  function addLine() {
    const newLine: SceneLine = {
      text: '',
      emphasis: 'normal',
      delayMs: scene.lines.length * 600,
    };
    onChange({ ...scene, lines: [...scene.lines, newLine] });
  }

  return (
    <div style={{
      background: '#FDFCF9',
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: 14,
      marginBottom: 14,
    }}>
      {/* Scene header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          Scene {index + 1} / {total}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{ ...MONO, fontSize: 12, background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? FAINT : MUTED, padding: '2px 4px' }}
            aria-label="Move scene up"
          >↑</button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{ ...MONO, fontSize: 12, background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', color: index === total - 1 ? FAINT : MUTED, padding: '2px 4px' }}
            aria-label="Move scene down"
          >↓</button>
          <button
            onClick={onDelete}
            disabled={total <= 1}
            style={{ ...MONO, fontSize: 10, color: total <= 1 ? FAINT : '#EF4444', background: 'none', border: 'none', cursor: total <= 1 ? 'not-allowed' : 'pointer', padding: '2px 6px' }}
          >✕ Delete</button>
        </div>
      </div>

      {/* Lines */}
      {scene.lines.map((line, i) => (
        <LineEditor
          key={i}
          line={line}
          onChange={updated => updateLine(i, updated)}
          onDelete={() => deleteLine(i)}
          canDelete={scene.lines.length > 1}
        />
      ))}

      <button
        onClick={addLine}
        style={{
          width: '100%', padding: '6px 0', marginBottom: 10,
          ...MONO, fontSize: 10, color: AMBER,
          background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 6, cursor: 'pointer',
        }}
      >+ Add line</button>

      {/* Scene-level controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Animation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ ...MONO, fontSize: 9, color: FAINT }}>Animation:</span>
          {ANIMATION_OPTIONS.map(a => (
            <Pill key={a} small active={scene.animation === a} onClick={() => onChange({ ...scene, animation: a })}>
              {a.replace('-', ' ')}
            </Pill>
          ))}
        </div>
        {/* Duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...MONO, fontSize: 9, color: FAINT }}>Duration</span>
          <input
            type="range"
            min={1} max={10} step={0.5}
            value={scene.durationSeconds}
            onChange={e => onChange({ ...scene, durationSeconds: parseFloat(e.target.value) })}
            style={{ width: 100 }}
          />
          <span style={{ ...MONO, fontSize: 10, color: DARK, minWidth: 32 }}>{scene.durationSeconds}s</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
interface VideoDrawerProps {
  open:     boolean;
  onClose:  () => void;
  showToast: (msg: string, ok?: boolean) => void;
}

type Mode = 'form' | 'preview' | 'rendering';

export default function VideoDrawer({ open, onClose, showToast }: VideoDrawerProps) {
  // ── Stage ────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('form');

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

  // ── Preview state ────────────────────────────────────────────
  const [story,            setStory]            = useState<StoryEngineResponse | null>(null);
  const [previewing,       setPreviewing]       = useState(false);
  const [regenerating,     setRegenerating]     = useState(false);

  // ── Job state ────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [activeJobId,  setActiveJobId]  = useState<string | null>(null);
  const [jobStatus,    setJobStatus]    = useState<VideoJob | null>(null);
  const [polling,      setPolling]      = useState(false);
  const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Past jobs list ───────────────────────────────────────────
  const [pastJobs,     setPastJobs]     = useState<VideoJob[]>([]);
  const [loadingJobs,  setLoadingJobs]  = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => {
    if (!open) { stopPolling(); return; }
    loadPastJobs();
    return () => { stopPolling(); };
  }, [open, stopPolling]);

  async function loadPastJobs() {
    setLoadingJobs(true);
    try {
      const res  = await fetch('/api/admin/video/list');
      const data = await res.json();
      if (data.jobs) setPastJobs(data.jobs);
    } catch { /* non-fatal */ }
    setLoadingJobs(false);
  }

  function startPolling(jobId: string) {
    stopPolling();
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/admin/video/status?jobId=${jobId}`);
        const data = await res.json();
        setJobStatus(data);
        if (data.status === 'complete' || data.status === 'failed') {
          stopPolling();
          loadPastJobs();
          if (data.status === 'complete') {
            showToast(`Video ready — ${data.sceneCount} scenes · ${data.totalDurationSeconds}s`, true);
          } else {
            showToast('Video generation failed: ' + (data.errorMessage ?? 'unknown error'), false);
          }
        }
      } catch { /* transient — next tick will retry */ }
    }, 4000);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      showToast(`Unsupported image type: ${file.type}. Use PNG, JPG, or WEBP.`, false);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${(MAX_IMAGE_BYTES / 1024 / 1024)}MB.`, false);
      e.target.value = '';
      return;
    }
    setCtaImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCtaImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function validateForm(): string | null {
    if (!goal.trim())            return 'Goal is required.';
    if (!keyMessage.trim())      return 'Key message is required.';
    if (keyMessage.length > MAX_KEY_MESSAGE_CHARS) return `Key message is too long (max ${MAX_KEY_MESSAGE_CHARS}).`;
    if (!ctaText.trim())         return 'CTA button text is required.';
    if (!ctaUrl.trim())          return 'CTA button URL is required.';
    if (!isValidUrl(ctaUrl.trim())) return 'CTA button URL must be a valid http(s) URL.';
    const needsImage = ctaTemplate === 'image-top' || ctaTemplate === 'split';
    if (needsImage && !ctaImageFile) return `The "${ctaTemplate}" template requires a CTA image.`;
    return null;
  }

  function buildFormInput() {
    return {
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
    };
  }

  // ── Preview (stage 1) ────────────────────────────────────────
  async function handlePreview() {
    if (previewing) return;
    const err = validateForm();
    if (err) { showToast(err, false); return; }

    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/video/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formInput: buildFormInput() }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast('Preview failed: ' + (data.error ?? 'unknown error'), false);
        return;
      }
      setStory(data.story as StoryEngineResponse);
      setMode('preview');
      showToast(`Preview ready — ${data.story.scenes.length} scenes`, true);
    } catch (e: any) {
      showToast('Preview error: ' + e.message, false);
    } finally {
      setPreviewing(false);
    }
  }

  // ── Regenerate — same form inputs, new Claude call ───────────
  async function handleRegenerate() {
    if (regenerating) return;
    if (!confirm('Regenerate will discard your current edits. Continue?')) return;

    setRegenerating(true);
    try {
      const res = await fetch('/api/admin/video/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formInput: buildFormInput() }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast('Regenerate failed: ' + (data.error ?? 'unknown error'), false);
        return;
      }
      setStory(data.story as StoryEngineResponse);
      showToast(`New script ready — ${data.story.scenes.length} scenes`, true);
    } catch (e: any) {
      showToast('Regenerate error: ' + e.message, false);
    } finally {
      setRegenerating(false);
    }
  }

  // ── Render (stage 2) — uses the edited story as presetStory ──
  async function handleRender() {
    if (submitting || !story) return;

    // Validate story before sending
    if (story.scenes.length === 0) {
      showToast('Add at least one scene before rendering.', false);
      return;
    }
    for (let i = 0; i < story.scenes.length; i++) {
      const s = story.scenes[i];
      if (s.lines.length === 0 || s.lines.every(l => !l.text.trim())) {
        showToast(`Scene ${i + 1} has no text lines.`, false);
        return;
      }
    }
    if (!story.ctaHeadline.trim()) {
      showToast('CTA headline is required.', false);
      return;
    }
    if (audioMode === 'voiceover' && !story.voiceoverScript.trim()) {
      showToast('Voiceover script is required when audio mode is voiceover.', false);
      return;
    }

    setSubmitting(true);
    try {
      let ctaImageBase64: string | undefined;
      let ctaImageMimeType: string | undefined;
      if (ctaImageFile) {
        ctaImageBase64   = await fileToBase64(ctaImageFile);
        ctaImageMimeType = ctaImageFile.type;
      }

      const clientRequestId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Recompute total duration — the edit session may have changed scene durations
      const recomputedTotal =
        story.scenes.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) +
        CTA_DURATION_SECONDS;

      const res = await fetch('/api/admin/video/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clientRequestId,
          formInput: buildFormInput(),
          ctaImageBase64,
          ctaImageMimeType,
          scheduleToBuffer: scheduleBuffer,
          presetStory: { ...story, totalDurationSeconds: recomputedTotal },
        }),
      });

      const data = await res.json();
      if (!data.success) {
        showToast('Error: ' + (data.error ?? 'unknown error'), false);
        setSubmitting(false);
        return;
      }

      setActiveJobId(data.jobId);
      setJobStatus({
        id: data.jobId, status: 'queued',
        goal, narrative_style: style, theme, audio_mode: audioMode,
        scene_count: story.scenes.length,
        total_duration_seconds: recomputedTotal,
        video_url: null, error_message: null,
        created_at: new Date().toISOString(),
        completed_at: null, duration_ms: null,
      });
      setMode('rendering');
      startPolling(data.jobId);
      showToast(`Render queued — job ${data.jobId.slice(0, 8)}… (~2–4 min)`);
    } catch (e: any) {
      showToast('Render error: ' + e.message, false);
    } finally {
      setSubmitting(false);
    }
  }

  function backToForm() {
    if (story && !confirm('Go back to the form? Your edits will be lost.')) return;
    setStory(null);
    setMode('form');
  }

  // ── Phase 4: row actions (retry, cancel, delete) ────────────
  async function handleRetry(jobId: string) {
    try {
      const res = await fetch(`/api/admin/video/retry?jobId=${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast('Retry failed: ' + (data.error ?? 'unknown'), false);
        return;
      }
      showToast(`Job retried (attempt ${data.retryCount}). Rendering…`);
      loadPastJobs();
      // If this is the current active job, re-start polling
      if (activeJobId === jobId) startPolling(jobId);
    } catch (e: any) {
      showToast('Retry error: ' + e.message, false);
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm('Cancel this in-flight render? It cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/video/cancel?jobId=${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast('Cancel failed: ' + (data.error ?? 'unknown'), false);
        return;
      }
      showToast(data.message || 'Job cancelled.');
      loadPastJobs();
      if (activeJobId === jobId) stopPolling();
    } catch (e: any) {
      showToast('Cancel error: ' + e.message, false);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm('Delete this video? The MP4 stays in storage but the row is hidden.')) return;
    try {
      const res = await fetch(`/api/admin/video/delete?jobId=${jobId}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast('Delete failed: ' + (data.error ?? 'unknown'), false);
        return;
      }
      showToast('Video deleted.');
      loadPastJobs();
    } catch (e: any) {
      showToast('Delete error: ' + e.message, false);
    }
  }

  function resetEverything() {
    stopPolling();
    setGoal(''); setKeyMessage(''); setStyle('authentic-story');
    setAudience('builder'); setTheme('dark');
    setCtaTemplate('dark-centered'); setCtaText(''); setCtaUrl('');
    setCtaImageFile(null); setCtaImagePreview(null);
    setAudioMode('none'); setScheduleBuffer(false);
    setActiveJobId(null); setJobStatus(null);
    setStory(null);
    setMode('form');
  }

  if (!open) return null;

  const needsImage   = ctaTemplate === 'image-top' || ctaTemplate === 'split';
  const ctaTemplates = makeCtaPreviews(theme);

  // Live-computed totals for the preview stage
  const previewTotalDuration = story
    ? story.scenes.reduce((s, sc) => s + (sc.durationSeconds || 0), 0) + CTA_DURATION_SECONDS
    : 0;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(12,11,8,0.55)',
        zIndex: 200, backdropFilter: 'blur(2px)',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 620, // widened for the editor
        background: '#FDFCF9',
        borderLeft: `1px solid ${BORDER}`,
        zIndex: 201, overflowY: 'auto',
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
              Video Engine · {mode === 'form' ? 'Step 1 · Setup' : mode === 'preview' ? 'Step 2 · Review & Edit' : 'Step 3 · Rendering'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: DARK }}>
              {mode === 'form' ? 'Create video' : mode === 'preview' ? 'Review script' : 'Rendering video'}
            </div>
          </div>
          <button onClick={onClose} style={{ ...MONO, fontSize: 14, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }} aria-label="Close drawer">✕</button>
        </div>

        {/* ── Active job status (rendering mode) ──────────────── */}
        {mode === 'rendering' && jobStatus && (
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
              <button onClick={resetEverything} style={{ ...MONO, fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>
                New video
              </button>
            </div>

            {jobStatus.status === 'complete' && jobStatus.video_url && (
              <div>
                <video src={jobStatus.video_url} controls style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 340, background: '#000' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a href={`/api/admin/video/download?jobId=${jobStatus.id}`} download style={{ ...MONO, fontSize: 10, padding: '6px 14px', borderRadius: 6, border: `1px solid ${BORDER}`, color: AMBER_BRIGHT, textDecoration: 'none', background: WARM }}>↓ Download MP4</a>
                  <button onClick={() => { navigator.clipboard.writeText(jobStatus.video_url!); showToast('URL copied'); }} style={{ ...MONO, fontSize: 10, padding: '6px 14px', borderRadius: 6, border: `1px solid ${BORDER}`, color: MUTED, background: WARM, cursor: 'pointer' }}>Copy URL</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Form (mode === 'form') ────────────────────────── */}
        {mode === 'form' && (
          <div style={{ padding: '20px 24px', flex: 1 }}>
            <Section>
              <Label>Goal of this video</Label>
              <select value={goal} onChange={e => setGoal(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 13, ...MONO, color: DARK }}>
                <option value="">Select a goal…</option>
                <option>Invite people to an event</option>
                <option>Promote a product or service</option>
                <option>Build personal authority</option>
                <option>Drive sign-ups to Ascentor</option>
                <option>Share a leadership insight</option>
                <option>Announce something new</option>
              </select>
            </Section>

            <Section>
              <Label>Key message</Label>
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 6 }}>
                One sentence: what must the viewer feel and do?
              </div>
              <textarea value={keyMessage} onChange={e => setKeyMessage(e.target.value.slice(0, MAX_KEY_MESSAGE_CHARS))} rows={3} placeholder="e.g. Most African professionals are playing it safe when they should be building. I want them to register for our leadership summit." style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK, resize: 'vertical', lineHeight: 1.65 }} />
              <div style={{ ...MONO, fontSize: 9, color: FAINT, textAlign: 'right', marginTop: 2 }}>{keyMessage.length} / {MAX_KEY_MESSAGE_CHARS}</div>
            </Section>

            <Section>
              <Label>Narrative style</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['authentic-story','hard-truth','contrast','insight','challenge','journey'] as NarrativeStyle[]).map(s => (
                  <Pill key={s} active={style === s} onClick={() => setStyle(s)}>{s.replace('-', ' ')}</Pill>
                ))}
              </div>
            </Section>

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

            <Section>
              <Label>Theme</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['dark','light'] as VideoTheme[]).map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${theme === t ? AMBER : BORDER}`,
                    background: t === 'dark' ? (theme === t ? '#1a1a1a' : '#111') : (theme === t ? '#fafaf5' : WARM),
                    color: t === 'dark' ? '#fff' : DARK,
                    ...MONO, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t === 'dark' ? '#333' : '#ddd', border: `1px solid ${t === 'dark' ? '#555' : '#bbb'}` }} />
                    {t === 'dark' ? 'Dark cinematic' : 'Light minimal'}
                  </button>
                ))}
              </div>
            </Section>

            <Section>
              <Label>CTA screen template</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                {ctaTemplates.map(tmpl => (
                  <div key={tmpl.id} onClick={() => setCtaTemplate(tmpl.id)} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${ctaTemplate === tmpl.id ? AMBER : BORDER}`, transition: 'border-color .15s' }}>
                    {tmpl.preview}
                    <div style={{ ...MONO, fontSize: 9, color: ctaTemplate === tmpl.id ? AMBER : MUTED, textAlign: 'center', padding: '5px 4px', background: WARM }}>{tmpl.label}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section>
              <Label>CTA button</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="text" placeholder="Button text" value={ctaText} onChange={e => setCtaText(e.target.value.slice(0, MAX_CTA_BUTTON_CHARS))} maxLength={MAX_CTA_BUTTON_CHARS} style={{ padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK }} />
                <input type="url" placeholder="https://ascentorbi.com/…" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} style={{ padding: '9px 12px', border: `1px solid ${ctaUrl && !isValidUrl(ctaUrl) ? '#EF4444' : BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK }} />
              </div>
              {ctaUrl && !isValidUrl(ctaUrl) && (
                <div style={{ ...MONO, fontSize: 9, color: '#EF4444', marginTop: 4 }}>Enter a valid URL starting with https://</div>
              )}
            </Section>

            <Section>
              <Label>CTA image <span style={{ color: FAINT, fontWeight: 400, textTransform: 'none', fontSize: 9, marginLeft: 4 }}>{needsImage ? '— required for this template' : '— optional'}</span></Label>
              <label htmlFor="cta-img-input" style={{ display: 'block', border: `1px dashed ${needsImage && !ctaImageFile ? AMBER_BRIGHT : BORDER}`, borderRadius: 8, padding: ctaImagePreview ? 0 : '18px 12px', textAlign: 'center', cursor: 'pointer', background: WARM, overflow: 'hidden' }}>
                {ctaImagePreview ? (
                  <img src={ctaImagePreview} alt="CTA preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>↑</div>
                    <div style={{ ...MONO, fontSize: 10, color: MUTED }}>{needsImage ? 'Upload required — event banner, book cover, headshot' : 'Upload image — event banner, book cover, headshot'}</div>
                    <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 4 }}>PNG, JPG, WEBP — max 5MB</div>
                  </>
                )}
              </label>
              <input id="cta-img-input" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleImageChange} />
              {ctaImagePreview && (
                <button onClick={() => { setCtaImageFile(null); setCtaImagePreview(null); }} style={{ ...MONO, fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', marginTop: 6 }}>✕ Remove image</button>
              )}
            </Section>

            <Section>
              <Label>Audio</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { id: 'voiceover', label: 'Voiceover', sub: 'ElevenLabs AI' },
                  { id: 'soundtrack', label: 'Soundtrack', sub: 'From library' },
                  { id: 'none', label: 'No audio', sub: 'Silent' },
                ] as { id: AudioMode; label: string; sub: string }[]).map(a => (
                  <button key={a.id} onClick={() => setAudioMode(a.id)} style={{ padding: '10px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${audioMode === a.id ? AMBER : BORDER}`, background: audioMode === a.id ? 'rgba(160,114,10,0.06)' : WARM, textAlign: 'center' }}>
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

            <Section>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={scheduleBuffer} onChange={e => setScheduleBuffer(e.target.checked)} style={{ width: 14, height: 14, accentColor: AMBER }} />
                <span style={{ ...MONO, fontSize: 11, color: MUTED }}>Queue to Buffer (LinkedIn) when complete</span>
              </label>
            </Section>

            <div style={{ background: WARM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 10, color: MUTED }}>Preview is ~$0.01–0.02 · render is same + {audioMode === 'voiceover' ? '~$0.10 ElevenLabs' : 'compute only'}</span>
            </div>

            {/* Preview button (primary) */}
            <button
              onClick={handlePreview}
              disabled={previewing}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
                cursor: previewing ? 'not-allowed' : 'pointer',
                background: previewing ? '#9E9B94' : DARK,
                color: '#fff', fontSize: 13, ...MONO, letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              {previewing ? 'Generating script…' : '✨  Preview script'}
            </button>
            <div style={{ ...MONO, fontSize: 9, color: FAINT, textAlign: 'center' }}>
              Review + edit before rendering — saves money and time
            </div>
          </div>
        )}

        {/* ── Preview mode ──────────────────────────────────── */}
        {mode === 'preview' && story && (
          <div style={{ padding: '20px 24px', flex: 1 }}>
            {/* Summary strip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: WARM, border: `1px solid ${BORDER}`,
              borderRadius: 8, marginBottom: 20,
            }}>
              <div>
                <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 2 }}>Total</div>
                <div style={{ ...MONO, fontSize: 12, color: DARK }}>
                  {story.scenes.length} scenes · {previewTotalDuration}s (incl. {CTA_DURATION_SECONDS}s CTA)
                </div>
              </div>
              <button
                onClick={backToForm}
                style={{ ...MONO, fontSize: 10, color: MUTED, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
              >
                ← Back to form
              </button>
            </div>

            {/* Scenes */}
            <Label>Scenes</Label>
            {story.scenes.map((scene, i) => (
              <SceneEditor
                key={scene.id ?? i}
                scene={scene}
                index={i}
                total={story.scenes.length}
                onChange={(updated) => {
                  const scenes = story.scenes.map((s, idx) => idx === i ? updated : s);
                  setStory({ ...story, scenes });
                }}
                onDelete={() => {
                  if (story.scenes.length <= 1) { showToast('Need at least one scene.', false); return; }
                  setStory({ ...story, scenes: story.scenes.filter((_, idx) => idx !== i) });
                }}
                onMoveUp={() => {
                  if (i === 0) return;
                  const scenes = [...story.scenes];
                  [scenes[i - 1], scenes[i]] = [scenes[i], scenes[i - 1]];
                  setStory({ ...story, scenes });
                }}
                onMoveDown={() => {
                  if (i === story.scenes.length - 1) return;
                  const scenes = [...story.scenes];
                  [scenes[i], scenes[i + 1]] = [scenes[i + 1], scenes[i]];
                  setStory({ ...story, scenes });
                }}
              />
            ))}

            <button
              onClick={() => {
                const newScene: NarrativeScene = {
                  id: `scene_${Date.now()}`,
                  lines: [{ text: '', emphasis: 'normal', delayMs: 0 }],
                  durationSeconds: 3,
                  animation: 'fade-up',
                };
                setStory({ ...story, scenes: [...story.scenes, newScene] });
              }}
              style={{
                width: '100%', padding: '10px 0', marginBottom: 24,
                ...MONO, fontSize: 11, color: AMBER,
                background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 8, cursor: 'pointer',
              }}
            >
              + Add scene
            </button>

            {/* CTA editor */}
            <Label>CTA copy</Label>
            <Section>
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Headline (max 8 words suggested)</div>
              <input
                type="text"
                value={story.ctaHeadline}
                onChange={e => setStory({ ...story, ctaHeadline: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 13, ...MONO, color: DARK, marginBottom: 10 }}
              />
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Subtitle</div>
              <input
                type="text"
                value={story.ctaSubtitle}
                onChange={e => setStory({ ...story, ctaSubtitle: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK, marginBottom: 10 }}
              />
              <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Closing line (used by "minimal-link" template)</div>
              <input
                type="text"
                value={story.closingLine}
                onChange={e => setStory({ ...story, closingLine: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK, fontStyle: 'italic' }}
              />
            </Section>

            {/* Voiceover editor — only if audioMode is voiceover */}
            {audioMode === 'voiceover' && (
              <>
                <Label>Voiceover script <span style={{ color: FAINT, fontWeight: 400, textTransform: 'none', fontSize: 9, marginLeft: 4 }}>— exact text ElevenLabs will read</span></Label>
                <Section>
                  <textarea
                    value={story.voiceoverScript}
                    onChange={e => setStory({ ...story, voiceoverScript: e.target.value })}
                    rows={8}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, background: WARM, fontSize: 12, ...MONO, color: DARK, resize: 'vertical', lineHeight: 1.7 }}
                  />
                </Section>
              </>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 24, marginBottom: 10 }}>
              <button
                onClick={handleRegenerate}
                disabled={regenerating || submitting}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 8,
                  border: `1px solid ${BORDER}`, background: WARM,
                  cursor: (regenerating || submitting) ? 'not-allowed' : 'pointer',
                  color: regenerating ? FAINT : MUTED,
                  fontSize: 12, ...MONO,
                }}
              >
                {regenerating ? 'Regenerating…' : '↻ Regenerate'}
              </button>
              <button
                onClick={handleRender}
                disabled={submitting || regenerating}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 8, border: 'none',
                  cursor: (submitting || regenerating) ? 'not-allowed' : 'pointer',
                  background: submitting ? '#9E9B94' : DARK,
                  color: '#fff', fontSize: 13, ...MONO, letterSpacing: '0.04em',
                }}
              >
                {submitting ? 'Queuing…' : '▶  Render this script'}
              </button>
            </div>
            <div style={{ ...MONO, fontSize: 9, color: FAINT, textAlign: 'center' }}>
              Rendering uses your edited script. No additional Claude cost.
            </div>
          </div>
        )}

        {/* ── Past jobs list ────────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 24px' }}>
          <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Recent videos
          </div>
          {loadingJobs ? (
            <div style={{ ...MONO, fontSize: 10, color: FAINT }}>Loading…</div>
          ) : pastJobs.length === 0 ? (
            <div style={{ ...MONO, fontSize: 10, color: FAINT }}>No videos yet.</div>
          ) : pastJobs.slice(0, 8).map(job => {
            const costTotal = typeof job.cost_usd_total === 'number' ? job.cost_usd_total : null;
            const renderMs = job.timings?.render_ms ?? null;
            const isInFlight = job.status === 'queued' || job.status === 'processing';
            return (
              <div key={job.id} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: DARK, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.goal}</div>
                    <div style={{ ...MONO, fontSize: 9, color: FAINT }}>
                      {job.narrative_style} · {job.theme} · {timeAgo(job.created_at)}
                      {job.scene_count ? ` · ${job.scene_count} scenes` : ''}
                      {typeof job.retry_count === 'number' && job.retry_count > 0 ? ` · retried ${job.retry_count}×` : ''}
                      {job.used_preset ? ' · preset' : ''}
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
                    }}>{job.status}</span>
                    {job.video_url && (
                      <a href={job.video_url} target="_blank" rel="noreferrer" style={{ ...MONO, fontSize: 9, color: AMBER_BRIGHT, textDecoration: 'none' }}>↗ View</a>
                    )}
                  </div>
                </div>

                {/* Phase 5: cost + timings line (complete jobs only) */}
                {job.status === 'complete' && (costTotal !== null || renderMs !== null) && (
                  <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 4, display: 'flex', gap: 10 }}>
                    {costTotal !== null && <span>${Number(costTotal).toFixed(4)}</span>}
                    {typeof job.cost_usd_claude === 'number' && job.cost_usd_claude > 0 && (
                      <span style={{ color: FAINT }}>claude ${Number(job.cost_usd_claude).toFixed(4)}</span>
                    )}
                    {typeof job.cost_usd_elevenlabs === 'number' && job.cost_usd_elevenlabs > 0 && (
                      <span style={{ color: FAINT }}>11L ${Number(job.cost_usd_elevenlabs).toFixed(4)}</span>
                    )}
                    {renderMs !== null && <span>render {(renderMs / 1000).toFixed(1)}s</span>}
                    {job.duration_ms && <span>total {(job.duration_ms / 1000).toFixed(1)}s</span>}
                  </div>
                )}

                {/* Phase 5: error line (failed jobs only) */}
                {job.status === 'failed' && job.error_message && (
                  <div style={{ ...MONO, fontSize: 9, color: '#EF4444', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.error_message}
                  </div>
                )}

                {/* Phase 4: action buttons */}
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  {job.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      style={{ ...MONO, fontSize: 9, color: AMBER_BRIGHT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >↻ Retry</button>
                  )}
                  {isInFlight && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      style={{ ...MONO, fontSize: 9, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >⨯ Cancel</button>
                  )}
                  {!isInFlight && (
                    <button
                      onClick={() => handleDelete(job.id)}
                      style={{ ...MONO, fontSize: 9, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >🗑 Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </>
  );
}
