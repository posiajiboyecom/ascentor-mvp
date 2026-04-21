'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor Clip+CTA Drawer
// Drop in: app/admin/content/ClipCTADrawer.tsx
//
// Three-step flow:
//   Step 1 — Upload clip (drag or tap, validates size + duration)
//   Step 2 — Build CTA (template, transition, image crop, text)
//   Step 3 — Generating / complete (polling + video player)
//
// Mobile-first throughout. No external dependencies beyond
// what the app already uses. Image cropping is pure canvas.
// ═══════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback } from 'react';
import type { CTATemplate, TransitionType, AspectPreset, ClipCTAFormInput } from '@/types/clip-cta';

// ── Design tokens (matches VideoDrawer + admin shell) ────────
const MONO: React.CSSProperties   = { fontFamily: "'DM Mono', monospace" };
const AMBER        = '#A0720A';
const AMBER_BRIGHT = '#E8A020';
const DARK         = '#0C0B08';
const WARM         = '#F5F3EE';
const MUTED        = '#6B6860';
const FAINT        = '#9E9B94';
const BORDER       = '#E2DDD4';

const MAX_CLIP_BYTES   = 100 * 1024 * 1024;
const MAX_CLIP_S       = 300; // 5 min
const MAX_IMAGE_BYTES  = 5 * 1024 * 1024;

// ── Label component ──────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 22, ...style }}>{children}</div>;
}

// ── Pill selector ────────────────────────────────────────────
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
      fontSize: 11, ...MONO,
      border: `1px solid ${active ? AMBER_BRIGHT : BORDER}`,
      background: active ? AMBER_BRIGHT : WARM,
      color: active ? DARK : MUTED,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// IMAGE CROPPER
// Pure canvas — no external library. Admin picks an aspect
// ratio preset, drags a crop rect over the image, gets a
// cropped blob back.
// ─────────────────────────────────────────────────────────────
interface CropperProps {
  src:        string;         // object URL of the original image
  aspect:     number;         // width/height ratio
  onConfirm:  (blob: Blob) => void;
  onCancel:   () => void;
}

function ImageCropper({ src, aspect, onConfirm, onCancel }: CropperProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0 });

  // Crop rect in canvas-pixel space
  const cropRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [ready, setReady] = useState(false);

  // Scale: we render the image inside a max 400×500 canvas
  const scale = useRef(1);

  function initCrop(imgW: number, imgH: number, canvasW: number, canvasH: number) {
    // Default crop: center, fills as much as possible given aspect
    let w = canvasW;
    let h = w / aspect;
    if (h > canvasH) { h = canvasH; w = h * aspect; }
    const x = (canvasW - w) / 2;
    const y = (canvasH - h) / 2;
    cropRect.current = { x, y, w, h };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const MAX_W = 400, MAX_H = 500;
      const s = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      scale.current = s;
      canvas.width  = Math.round(img.width  * s);
      canvas.height = Math.round(img.height * s);
      initCrop(img.width, img.height, canvas.width, canvas.height);
      draw();
      setReady(true);
    };
    img.src = src;
  }, [src, aspect]);

  function draw() {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Dark overlay outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    const { x, y, w, h } = cropRect.current;
    ctx.fillRect(0, 0, canvas.width, y);                    // top
    ctx.fillRect(0, y + h, canvas.width, canvas.height);    // bottom
    ctx.fillRect(0, y, x, h);                               // left
    ctx.fillRect(x + w, y, canvas.width - x - w, h);       // right

    // Crop border
    ctx.strokeStyle = '#E8A020';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    // Corner handles
    const hs = 10;
    ctx.fillStyle = '#E8A020';
    [[x, y], [x + w - hs, y], [x, y + h - hs], [x + w - hs, y + h - hs]].forEach(([cx, cy]) => {
      ctx.fillRect(cx, cy, hs, hs);
    });
  }

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    isDragging.current = true;
    const pos = getPos(e);
    dragStart.current = pos;
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDragging.current) return;
    const canvas = canvasRef.current!;
    const pos    = getPos(e);
    const dx     = pos.x - dragStart.current.x;
    const dy     = pos.y - dragStart.current.y;
    const { x, y, w, h } = cropRect.current;

    // Move the crop rect, clamp to canvas bounds
    cropRect.current = {
      x: Math.max(0, Math.min(canvas.width  - w, x + dx)),
      y: Math.max(0, Math.min(canvas.height - h, y + dy)),
      w,
      h,
    };
    dragStart.current = pos;
    draw();
  }

  function onPointerUp() {
    isDragging.current = false;
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    const { x, y, w, h } = cropRect.current;
    const s = scale.current;

    // Map canvas coords back to original image coords
    const sx = x / s, sy = y / s, sw = w / s, sh = h / s;

    const out = document.createElement('canvas');
    out.width  = Math.round(sw);
    out.height = Math.round(sh);
    out.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    out.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  }

  return (
    <div style={{ background: DARK, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 8px', ...MONO, fontSize: 10, color: FAINT }}>
        Drag to reposition crop · Gold border = crop area
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', cursor: 'move', touchAction: 'none' }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px' }}>
        <button
          onClick={handleConfirm}
          disabled={!ready}
          style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', background: AMBER_BRIGHT, color: DARK, ...MONO, fontSize: 11, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed' }}
        >
          Use this crop
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '9px 16px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, ...MONO, fontSize: 11, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA TEMPLATE CARD
// ─────────────────────────────────────────────────────────────
function TemplateCard({ id, label, icon, active, onClick }: {
  id: CTATemplate; label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
      border: `1.5px solid ${active ? AMBER_BRIGHT : BORDER}`,
      background: active ? 'rgba(232,160,32,0.08)' : WARM,
      width: '100%',
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ ...MONO, fontSize: 9, color: active ? AMBER_BRIGHT : MUTED, textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// TRANSITION CARD
// ─────────────────────────────────────────────────────────────
function TransitionCard({ id, label, desc, active, onClick }: {
  id: TransitionType; label: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
      border: `1.5px solid ${active ? AMBER_BRIGHT : BORDER}`,
      background: active ? 'rgba(232,160,32,0.08)' : WARM,
    }}>
      <div style={{ ...MONO, fontSize: 11, color: active ? AMBER_BRIGHT : DARK, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 9, color: FAINT, lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// TEXT INPUT
// ─────────────────────────────────────────────────────────────
function TextInput({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 7,
        border: `1px solid ${BORDER}`, background: '#fff',
        fontSize: 13, ...MONO, color: DARK,
        boxSizing: 'border-box',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN DRAWER
// ─────────────────────────────────────────────────────────────
interface ClipCTADrawerProps {
  open:      boolean;
  onClose:   () => void;
  showToast: (msg: string, ok?: boolean) => void;
  onJobCreated: () => void;
}

type Step = 'upload' | 'build' | 'generating' | 'done';

const TEMPLATES: { id: CTATemplate; label: string; icon: string; needsImage: boolean; hasText: boolean }[] = [
  { id: 'dark-centered',  label: 'Dark centered',  icon: '◼',  needsImage: false, hasText: true  },
  { id: 'light-centered', label: 'Light centered', icon: '◻',  needsImage: false, hasText: true  },
  { id: 'fullbg-branded', label: 'Full branded',   icon: '★',  needsImage: false, hasText: true  },
  { id: 'minimal-link',   label: 'Minimal link',   icon: '↗',  needsImage: false, hasText: true  },
  { id: 'image-top',      label: 'Image + text',   icon: '🖼',  needsImage: true,  hasText: true  },
  { id: 'split',          label: 'Split image',    icon: '⬛',  needsImage: true,  hasText: true  },
  { id: 'fullbg-image',   label: 'Full image',     icon: '📷',  needsImage: true,  hasText: false },
];

const TRANSITIONS: { id: TransitionType; label: string; desc: string }[] = [
  { id: 'fade-black',  label: 'Fade to black', desc: 'Clip fades out, CTA fades in' },
  { id: 'crossfade',   label: 'Crossfade',     desc: 'Smooth blend between the two' },
  { id: 'hard-cut',    label: 'Hard cut',       desc: 'Instant switch, no transition' },
];

const ASPECT_PRESETS: { id: AspectPreset; label: string; ratio: number }[] = [
  { id: '9:16',    label: '9:16 — Reels / TikTok', ratio: 9 / 16   },
  { id: '1:1',     label: '1:1 — Square',           ratio: 1        },
  { id: '1.91:1',  label: '1.91:1 — LinkedIn',      ratio: 1.91     },
  { id: '16:9',    label: '16:9 — Twitter / YouTube', ratio: 16 / 9 },
];

export default function ClipCTADrawer({ open, onClose, showToast, onJobCreated }: ClipCTADrawerProps) {
  // ── Step ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload');

  // ── Clip ─────────────────────────────────────────────────
  const [clipFile,     setClipFile]     = useState<File | null>(null);
  const [clipPreview,  setClipPreview]  = useState<string | null>(null);
  const [clipDuration, setClipDuration] = useState<number | null>(null);
  const [clipError,    setClipError]    = useState<string | null>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);

  // ── CTA form ─────────────────────────────────────────────
  const [template,    setTemplate]    = useState<CTATemplate>('dark-centered');
  const [transition,  setTransition]  = useState<TransitionType>('fade-black');
  const [ctaDuration, setCtaDuration] = useState(8);
  const [headline,    setHeadline]    = useState('');
  const [subtitle,    setSubtitle]    = useState('');
  const [buttonText,  setButtonText]  = useState('');
  const [buttonUrl,   setButtonUrl]   = useState('');
  const [closingLine, setClosingLine] = useState('');

  // ── Image cropper ────────────────────────────────────────
  const [rawImageSrc,   setRawImageSrc]   = useState<string | null>(null);
  const [croppedBlob,   setCroppedBlob]   = useState<File | null>(null);
  const [croppedPreview,setCroppedPreview]= useState<string | null>(null);
  const [aspectPreset,  setAspectPreset]  = useState<AspectPreset>('9:16');
  const [showCropper,   setShowCropper]   = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Job state ────────────────────────────────────────────
  const [jobId,       setJobId]       = useState<string | null>(null);
  const [videoUrl,    setVideoUrl]    = useState<string | null>(null);
  const [genError,    setGenError]    = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const templateMeta = TEMPLATES.find(t => t.id === template)!;
  const aspectRatio  = ASPECT_PRESETS.find(a => a.id === aspectPreset)!.ratio;

  // ── Reset on close ───────────────────────────────────────
  function reset() {
    setStep('upload');
    setClipFile(null); setClipPreview(null); setClipDuration(null); setClipError(null);
    setTemplate('dark-centered'); setTransition('fade-black'); setCtaDuration(8);
    setHeadline(''); setSubtitle(''); setButtonText(''); setButtonUrl(''); setClosingLine('');
    setRawImageSrc(null); setCroppedBlob(null); setCroppedPreview(null); setShowCropper(false);
    setJobId(null); setVideoUrl(null); setGenError(null); setSubmitting(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function handleClose() { reset(); onClose(); }

  // ── Clip file selection ──────────────────────────────────
  function handleClipSelect(file: File) {
    setClipError(null);
    if (!file.type.startsWith('video/')) {
      setClipError('Please upload a video file (MP4, MOV, WebM).'); return;
    }
    if (file.size > MAX_CLIP_BYTES) {
      setClipError(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 100MB.`); return;
    }

    // Accept the file immediately — never block on metadata.
    // Many TikTok/Instagram clips use codec profiles that browsers
    // cannot probe via <video>, but ffprobe on the server handles them fine.
    // We attempt a background metadata read only to show duration in the UI.
    const previewUrl = URL.createObjectURL(file);
    setClipFile(file);
    setClipPreview(previewUrl);
    setClipDuration(null);

    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      const dur = vid.duration;
      URL.revokeObjectURL(vid.src);
      if (!isNaN(dur) && isFinite(dur)) {
        if (dur > MAX_CLIP_S) {
          // Only block if we can actually confirm it is too long
          setClipError(`Clip too long (${Math.round(dur)}s). Max 5 minutes.`);
          setClipFile(null); setClipPreview(null);
          return;
        }
        setClipDuration(dur);
      }
    };
    vid.onerror = () => { URL.revokeObjectURL(vid.src); };
    vid.src = previewUrl;
  }

  // ── Image file selection ─────────────────────────────────
  function handleImageSelect(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_BYTES) { showToast('Image too large (max 5MB)', false); return; }
    const url = URL.createObjectURL(file);
    setRawImageSrc(url);
    setShowCropper(true);
  }

  function handleCropConfirm(blob: Blob) {
    // Wrap in a File so FormData sends it with the correct mime type and filename
    const file = new File([blob], 'cta-image.jpg', { type: 'image/jpeg' });
    setCroppedBlob(file);
    setCroppedPreview(URL.createObjectURL(file));
    setShowCropper(false);
  }

  // ── Form validation ──────────────────────────────────────
  function validate(): string | null {
    if (!clipFile) return 'No clip selected.';
    if (templateMeta.needsImage && !croppedBlob) return 'This template requires an image.';
    if (templateMeta.hasText) {
      if (!headline.trim()) return 'Headline is required.';
      if (template !== 'minimal-link' && !buttonText.trim()) return 'Button text is required.';
      if (template !== 'minimal-link' && !buttonUrl.trim()) return 'Button URL is required.';
      if (template === 'minimal-link' && !buttonUrl.trim()) return 'URL is required for minimal link.';
    }
    return null;
  }

  // ── Submit ───────────────────────────────────────────────
  async function handleSubmit() {
    const err = validate();
    if (err) { showToast(err, false); return; }
    setSubmitting(true);
    setGenError(null);

    try {
      const formData = new FormData();
      formData.append('clip', clipFile!);
      if (croppedBlob) formData.append('ctaImage', croppedBlob, 'cta-image.jpg');

      const formInput: ClipCTAFormInput = {
        ctaTemplate:     template,
        ctaDurationS:    ctaDuration,
        transitionType:  transition,
        ctaHeadline:     headline  || undefined,
        ctaSubtitle:     subtitle  || undefined,
        ctaButtonText:   buttonText|| undefined,
        ctaButtonUrl:    buttonUrl || undefined,
        ctaClosingLine:  closingLine || undefined,
        ctaAspectPreset: aspectPreset,
      };
      formData.append('formData', JSON.stringify(formInput));

      const res  = await fetch('/api/admin/clip-cta/generate', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) {
        setGenError(data.error ?? 'Unknown error');
        showToast(data.error ?? 'Generation failed', false);
        setSubmitting(false);
        return;
      }

      setJobId(data.jobId);
      setStep('generating');
      startPolling(data.jobId);

    } catch (e: any) {
      setGenError(e.message);
      showToast('Submission failed: ' + e.message, false);
      setSubmitting(false);
    }
  }

  // ── Poll for job status ──────────────────────────────────
  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/admin/clip-cta/status?jobId=${id}`);
        const data = await res.json();
        if (data.status === 'complete') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setVideoUrl(data.videoUrl);
          setStep('done');
          onJobCreated();
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setGenError(data.errorMessage ?? 'Render failed');
          setStep('generating'); // stays on generating screen but shows error
        }
      } catch { /* non-fatal */ }
    }, 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!open) return null;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxWidth: 520, margin: '0 auto',
        background: WARM, borderRadius: '16px 16px 0 0',
        zIndex: 201, maxHeight: '92dvh', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>

        {/* Handle + header */}
        <div style={{ padding: '12px 18px 0', position: 'sticky', top: 0, background: WARM, zIndex: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
                Clip + CTA
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: DARK }}>
                {step === 'upload' ? 'Upload your clip' :
                 step === 'build'  ? 'Build the CTA' :
                 step === 'generating' ? 'Processing…' : 'Done!'}
              </div>
            </div>
            <button onClick={handleClose} style={{ ...MONO, fontSize: 14, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
          </div>

          {/* Step indicators */}
          {(step === 'upload' || step === 'build') && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['upload', 'build'] as Step[]).map((s, i) => (
                <div key={s} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: step === s ? AMBER_BRIGHT : (
                    (step === 'build' && s === 'upload') ? '#10B981' : BORDER
                  ),
                }} />
              ))}
            </div>
          )}
          <div style={{ height: 1, background: BORDER, marginBottom: 4 }} />
        </div>

        <div style={{ padding: '16px 18px 32px' }}>

          {/* ════════ STEP 1: UPLOAD ════════ */}
          {step === 'upload' && (
            <>
              <Section>
                {/* Drop zone */}
                <div
                  onClick={() => clipInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleClipSelect(file);
                  }}
                  style={{
                    border: `2px dashed ${clipFile ? '#10B981' : clipError ? '#EF4444' : BORDER}`,
                    borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                    cursor: 'pointer', background: '#fff', marginBottom: 12,
                  }}
                >
                  {clipPreview ? (
                    <video
                      src={clipPreview}
                      controls
                      style={{ width: '100%', borderRadius: 8, maxHeight: 280, background: '#000' }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                      <div style={{ ...MONO, fontSize: 12, color: DARK, marginBottom: 4 }}>
                        Tap to upload a clip
                      </div>
                      <div style={{ ...MONO, fontSize: 10, color: FAINT }}>
                        MP4, MOV, WebM · max 100MB · max 5 min
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={clipInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleClipSelect(f); }}
                />
                {clipError && (
                  <div style={{ ...MONO, fontSize: 10, color: '#EF4444', marginTop: 6 }}>{clipError}</div>
                )}
                {clipFile && (
                  <div style={{ ...MONO, fontSize: 10, color: '#10B981', marginTop: 6 }}>
                    ✓ {clipFile.name}{clipDuration ? ` · ${Math.round(clipDuration)}s` : ''} · {(clipFile.size / 1024 / 1024).toFixed(1)}MB
                    <button
                      onClick={() => { setClipFile(null); setClipPreview(null); setClipDuration(null); }}
                      style={{ ...MONO, fontSize: 10, color: FAINT, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 10 }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </Section>

              <button
                onClick={() => { if (!clipFile) { showToast('Upload a clip first', false); return; } setStep('build'); }}
                disabled={!clipFile}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 8,
                  border: 'none', background: clipFile ? AMBER_BRIGHT : BORDER,
                  color: clipFile ? DARK : MUTED,
                  ...MONO, fontSize: 12, fontWeight: 700, cursor: clipFile ? 'pointer' : 'not-allowed',
                }}
              >
                Next: Build CTA →
              </button>
            </>
          )}

          {/* ════════ STEP 2: BUILD CTA ════════ */}
          {step === 'build' && (
            <>
              {/* Template picker */}
              <Section>
                <Label>CTA template</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {TEMPLATES.map(t => (
                    <TemplateCard
                      key={t.id} id={t.id} label={t.label} icon={t.icon}
                      active={template === t.id}
                      onClick={() => setTemplate(t.id)}
                    />
                  ))}
                </div>
              </Section>

              {/* Image upload + cropper (for image templates) */}
              {templateMeta.needsImage && (
                <Section>
                  <Label>CTA image <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: FAINT }}>— required</span></Label>

                  {/* Aspect ratio selector */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {ASPECT_PRESETS.map(a => (
                      <Pill key={a.id} active={aspectPreset === a.id} onClick={() => {
                        setAspectPreset(a.id);
                        if (rawImageSrc) setShowCropper(true);
                      }}>
                        {a.id}
                      </Pill>
                    ))}
                  </div>

                  {showCropper && rawImageSrc ? (
                    <ImageCropper
                      src={rawImageSrc}
                      aspect={aspectRatio}
                      onConfirm={handleCropConfirm}
                      onCancel={() => setShowCropper(false)}
                    />
                  ) : croppedPreview ? (
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <img
                        src={croppedPreview}
                        alt="CTA preview"
                        style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 200, objectFit: 'cover' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button
                          onClick={() => setShowCropper(true)}
                          style={{ ...MONO, fontSize: 10, color: AMBER, background: 'none', border: `1px solid ${AMBER}`, borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          Recrop
                        </button>
                        <button
                          onClick={() => { setCroppedBlob(null); setCroppedPreview(null); setRawImageSrc(null); }}
                          style={{ ...MONO, fontSize: 10, color: FAINT, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${BORDER}`, borderRadius: 8,
                        padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#fff',
                      }}
                    >
                      <div style={{ ...MONO, fontSize: 11, color: MUTED }}>Tap to upload image</div>
                      <div style={{ ...MONO, fontSize: 9, color: FAINT, marginTop: 4 }}>JPG, PNG, WEBP · max 5MB</div>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                  />
                </Section>
              )}

              {/* Text fields */}
              {templateMeta.hasText && (
                <Section>
                  <Label>CTA text</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {template !== 'fullbg-image' && (
                      <>
                        <div>
                          <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Headline *</div>
                          <TextInput value={headline} onChange={setHeadline} placeholder="Your next level starts here." maxLength={80} />
                        </div>
                        {template !== 'minimal-link' && (
                          <div>
                            <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Subtitle</div>
                            <TextInput value={subtitle} onChange={setSubtitle} placeholder="One sentence to close the door." maxLength={120} />
                          </div>
                        )}
                        {template === 'minimal-link' && (
                          <div>
                            <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Closing line</div>
                            <TextInput value={closingLine} onChange={setClosingLine} placeholder="The story line that echoes…" maxLength={120} />
                          </div>
                        )}
                        {template !== 'minimal-link' && (
                          <div>
                            <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>Button text *</div>
                            <TextInput value={buttonText} onChange={setButtonText} placeholder="Join free today" maxLength={32} />
                          </div>
                        )}
                        <div>
                          <div style={{ ...MONO, fontSize: 9, color: FAINT, marginBottom: 4 }}>URL *</div>
                          <TextInput value={buttonUrl} onChange={setButtonUrl} placeholder="https://ascentorbi.com" />
                        </div>
                      </>
                    )}
                  </div>
                </Section>
              )}

              {/* Transition */}
              <Section>
                <Label>Transition</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TRANSITIONS.map(t => (
                    <TransitionCard
                      key={t.id} id={t.id} label={t.label} desc={t.desc}
                      active={transition === t.id}
                      onClick={() => setTransition(t.id)}
                    />
                  ))}
                </div>
              </Section>

              {/* CTA duration */}
              <Section>
                <Label>CTA duration — {ctaDuration}s</Label>
                <input
                  type="range" min={3} max={15} step={1} value={ctaDuration}
                  onChange={e => setCtaDuration(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 9, color: FAINT, marginTop: 4 }}>
                  <span>3s</span><span>15s</span>
                </div>
              </Section>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep('upload')}
                  style={{ padding: '12px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, ...MONO, fontSize: 11, cursor: 'pointer' }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 8, border: 'none',
                    background: submitting ? BORDER : AMBER_BRIGHT,
                    color: submitting ? MUTED : DARK,
                    ...MONO, fontSize: 12, fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Uploading…' : '▶  Generate video'}
                </button>
              </div>
            </>
          )}

          {/* ════════ STEP 3: GENERATING / DONE ════════ */}
          {(step === 'generating' || step === 'done') && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {step === 'generating' && !genError && (
                <>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>⚙️</div>
                  <div style={{ ...MONO, fontSize: 13, color: DARK, marginBottom: 8 }}>
                    Stitching your video…
                  </div>
                  <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 24 }}>
                    This takes 1–3 minutes. You can close this drawer — the job will keep running.
                  </div>
                  <div style={{ height: 3, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: AMBER_BRIGHT, borderRadius: 2,
                      animation: 'indeterminate 1.6s ease-in-out infinite',
                      width: '40%',
                    }} />
                  </div>
                </>
              )}

              {step === 'generating' && genError && (
                <>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
                  <div style={{ ...MONO, fontSize: 12, color: '#EF4444', marginBottom: 8 }}>Generation failed</div>
                  <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 20, wordBreak: 'break-word' }}>{genError}</div>
                  <button
                    onClick={() => setStep('build')}
                    style={{ ...MONO, fontSize: 11, color: AMBER, background: 'none', border: `1px solid ${AMBER}`, borderRadius: 6, padding: '8px 18px', cursor: 'pointer' }}
                  >
                    ← Try again
                  </button>
                </>
              )}

              {step === 'done' && videoUrl && (
                <>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  <div style={{ ...MONO, fontSize: 13, color: '#10B981', marginBottom: 16 }}>Video ready!</div>
                  <video
                    src={videoUrl}
                    controls
                    style={{ width: '100%', borderRadius: 10, background: '#000', marginBottom: 16, maxHeight: 340 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <a
                      href={videoUrl}
                      download
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 8,
                        background: AMBER_BRIGHT, color: DARK,
                        ...MONO, fontSize: 11, fontWeight: 700,
                        textAlign: 'center', textDecoration: 'none',
                      }}
                    >
                      ↓ Download
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(videoUrl); showToast('URL copied'); }}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, ...MONO, fontSize: 11, cursor: 'pointer' }}
                    >
                      Copy URL
                    </button>
                  </div>
                  <button
                    onClick={handleClose}
                    style={{ width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 8, border: 'none', background: 'transparent', color: FAINT, ...MONO, fontSize: 11, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </>
  );
}
