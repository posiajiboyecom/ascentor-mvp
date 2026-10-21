'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const W = 1080;
const H = 1350;
const URL_PATH = '/elevation-summit/attend';
const SHARE_TEXT = 'I will be attending The Elevation Summit, Thursday 19 November 2026 in Lagos. Make your own flyer and join me:';
const FONT = 'Metropolis, system-ui, sans-serif';

type Variant = 'light' | 'dark' | 'bold';
const VARIANTS: { id: Variant; label: string }[] = [
  { id: 'light', label: 'Clean' },
  { id: 'dark', label: 'Night' },
  { id: 'bold', label: 'Bold' },
];

const THEME = {
  light: { bg: '#FAFAF8', ink: '#16171B', accent: '#B8892B', sub: '#5F6672', band: '#FFFFFF', bandInk: '#16171B', date: '#B6502A', logo: '/ascentor-color-for-light-pages.svg', ring: '#B8892B' },
  dark:  { bg: '#0C0B08', ink: '#F5F1E8', accent: '#E8A020', sub: '#A79F8C', band: '#17150F', bandInk: '#F5F1E8', date: '#E8A020', logo: '/ascentor-color-for-dark-pages.svg', ring: '#E8A020' },
  bold:  { bg: '#B6502A', ink: '#FFFFFF', accent: '#FFD9A0', sub: '#FBE3D6', band: '#16171B', bandInk: '#FFFFFF', date: '#FFD9A0', logo: '/ascentor-color-for-dark-pages.svg', ring: '#FFFFFF' },
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight = 900, min = 44) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  } while (size > min);
  return size;
}

/** Centred, letter-spaced text. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
}

async function draw(canvas: HTMLCanvasElement, v: Variant, name: string, line: string, photo: HTMLImageElement | null) {
  const t = THEME[v];
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try { await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(`${w} 48px Metropolis`))); } catch { /* falls back to the system font */ }
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);

  if (v === 'light') {
    const g = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 900);
    g.addColorStop(0, 'rgba(190,190,196,0.55)'); g.addColorStop(1, 'rgba(250,250,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  } else if (v === 'dark') {
    const g = ctx.createRadialGradient(W / 2, 480, 40, W / 2, 480, 620);
    g.addColorStop(0, 'rgba(232,160,32,0.22)'); g.addColorStop(1, 'rgba(12,11,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.arc(W - 120, 140, 360, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, 760, 260, 0, Math.PI * 2); ctx.fill();
  }

  // header: logo left, event name right
  try {
    const logo = await loadImage(t.logo);
    const lw = 330; const lh = lw * (101.16 / 380.8);
    ctx.drawImage(logo, 70, 70, lw, lh);
  } catch { /* the logo is decoration only */ }
  ctx.fillStyle = t.accent; ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = 'right';
  const theW = ctx.measureText('THE').width + 16;
  tracked(ctx, 'THE', W - 70 - theW / 2 - 118, 84, 8);
  ctx.textAlign = 'right'; ctx.fillStyle = t.ink; ctx.font = `900 40px ${FONT}`;
  ctx.fillText('ELEVATION', W - 70, 124);
  ctx.fillText('SUMMIT', W - 70, 168);

  // photo
  const cx = W / 2, cy = 480, r = 190;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fillStyle = t.ring; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (photo) {
    const s = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    const pw = photo.width * s, ph = photo.height * s;
    ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  } else {
    ctx.fillStyle = v === 'light' ? '#E7E3DA' : v === 'dark' ? '#26221A' : '#9A3F20';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const initials = (name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('') || 'A').toUpperCase();
    ctx.fillStyle = t.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 150px ${FONT}`;
    ctx.fillText(initials, cx, cy + 6);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // headline and name
  ctx.textAlign = 'center';
  ctx.fillStyle = t.accent; ctx.font = `700 30px ${FONT}`;
  tracked(ctx, 'I WILL BE ATTENDING', W / 2, 760, 10);
  const shown = (name.trim() || 'Your name').toUpperCase();
  ctx.fillStyle = t.ink;
  const size = fitText(ctx, shown, W - 140, 130);
  ctx.textAlign = 'center';
  let y = 760 + 30 + size * 0.9;
  ctx.fillText(shown, W / 2, y);
  if (line.trim()) {
    ctx.fillStyle = t.sub; ctx.font = `600 34px ${FONT}`;
    ctx.fillText(line.trim().slice(0, 60), W / 2, y + 52);
    y += 52;
  }
  ctx.fillStyle = t.ink; ctx.font = `900 56px ${FONT}`;
  ctx.fillText('THE RISE WE CHOOSE', W / 2, Math.max(y + 100, 1010));

  // venue band, skewed like the main flyer
  const by = 1090, bh = 150;
  ctx.fillStyle = t.band;
  ctx.beginPath(); ctx.moveTo(90, by); ctx.lineTo(W - 90, by); ctx.lineTo(W - 70, by + bh); ctx.lineTo(70, by + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.bandInk; ctx.font = `italic 800 38px ${FONT}`;
  ctx.fillText('ADEREMI MAKANJUOLA HALL', W / 2, by + 52);
  ctx.font = `italic 600 22px ${FONT}`;
  ctx.fillText('LAGOS STATE UNIVERSITY, IBA ROAD, LAGOS', W / 2, by + 86);
  ctx.fillStyle = t.date; ctx.font = `italic 900 36px ${FONT}`;
  ctx.fillText('THUR. 19 NOVEMBER, 2026', W / 2, by + 132);

  ctx.fillStyle = t.sub; ctx.font = `600 26px ${FONT}`;
  ctx.fillText('joinascentor.com/elevation-summit', W / 2, 1300);
}

export default function AttendClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [variant, setVariant] = useState<Variant>('light');
  const [name, setName] = useState('');
  const [line, setLine] = useState('');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoErr, setPhotoErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('https://joinascentor.com');
  const [canNative, setCanNative] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNative('share' in navigator);
    const n = new URLSearchParams(window.location.search).get('n');
    if (n) setName(n.slice(0, 40));
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (c) void draw(c, variant, name, line, photo);
  }, [variant, name, line, photo]);

  const onFile = useCallback((f: File | undefined) => {
    setPhotoErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setPhotoErr('Please choose an image file.'); return; }
    if (f.size > 15 * 1024 * 1024) { setPhotoErr('That image is over 15 MB. Please choose a smaller one.'); return; }
    const url = URL.createObjectURL(f);
    loadImage(url).then((img) => setPhoto(img)).catch(() => setPhotoErr('We could not read that image.'));
  }, []);

  const toBlob = () => new Promise<Blob | null>((res) => { if (canvasRef.current) canvasRef.current.toBlob(res, 'image/png'); else res(null); });
  const fileName = `attending-elevation-summit-${(name.trim() || 'flyer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  const shareUrl = `${origin}${URL_PATH}`;

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const nativeShare = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.canShare?.({ files: [file] })) await nav.share({ files: [file], text: `${SHARE_TEXT} ${shareUrl}` });
      else await nav.share({ text: SHARE_TEXT, url: shareUrl });
    } catch { /* cancelled */ }
  };

  const enc = encodeURIComponent;
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${SHARE_TEXT} ${shareUrl}`)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(SHARE_TEXT)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(SHARE_TEXT)}&url=${enc(shareUrl)}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(SHARE_TEXT)}` },
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <main style={{ background: '#FAFAF8', color: '#16171B', padding: 'clamp(5.5rem, 8vw, 7rem) 1.25rem 4rem' }}>
      <style>{`
        .at-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:2rem;max-width:1100px;margin:0 auto}
        @media(min-width:900px){.at-grid{grid-template-columns:minmax(0,420px) minmax(0,1fr);align-items:start}}
        .at-in{width:100%;height:48px;border:1px solid #cfcac2;border-radius:10px;padding:0 14px;font:inherit;font-size:16px;background:#fff;color:#16171B}
        .at-lbl{display:block;font-size:13px;font-weight:700;letter-spacing:.04em;margin:18px 0 6px;color:#5F6672}
        .at-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:10px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;border:1px solid #16171B;background:#fff;color:#16171B;text-decoration:none}
        .at-btn.p{background:#B6502A;border-color:#B6502A;color:#fff}
        .at-seg{display:flex;gap:8px;flex-wrap:wrap}
        .at-seg button{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid #cfcac2;background:#fff;font:inherit;font-weight:600;cursor:pointer;color:#16171B}
        .at-seg button[aria-pressed=true]{background:#16171B;color:#fff;border-color:#16171B}
        .at-share{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .at-share a,.at-share button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #cfcac2;background:#fff;font:inherit;font-weight:600;font-size:14px;text-decoration:none;color:#16171B;cursor:pointer;display:inline-flex;align-items:center}
      `}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto 2rem' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.18em', color: '#B8892B', margin: 0 }}>THE ELEVATION SUMMIT 2026</p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 900, lineHeight: 1.05, margin: '10px 0 12px' }}>I will be attending</h1>
        <p style={{ maxWidth: 620, color: '#5F6672', fontSize: 17, lineHeight: 1.6, margin: 0 }}>Make your flyer in a minute. Add your name and photo, pick a style, download it as a PNG and share it. No account needed.</p>
      </div>

      <div className="at-grid">
        <section aria-label="Your details">
          <span className="at-lbl" style={{ marginTop: 0 }}>STYLE</span>
          <div className="at-seg" role="group" aria-label="Flyer style">
            {VARIANTS.map((v) => <button key={v.id} type="button" aria-pressed={variant === v.id} onClick={() => setVariant(v.id)}>{v.label}</button>)}
          </div>

          <label className="at-lbl" htmlFor="at-name">YOUR NAME</label>
          <input id="at-name" className="at-in" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" autoComplete="name" />

          <label className="at-lbl" htmlFor="at-line">A SHORT LINE (OPTIONAL)</label>
          <input id="at-line" className="at-in" value={line} maxLength={60} onChange={(e) => setLine(e.target.value)} placeholder="Founder, Lagos" />

          <span className="at-lbl">YOUR PHOTO (OPTIONAL)</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="at-btn" onClick={() => fileRef.current?.click()}>{photo ? 'Change photo' : 'Upload a photo'}</button>
            {photo && <button type="button" className="at-btn" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>}
          </div>
          <p style={{ fontSize: 13, color: '#5F6672', margin: '8px 0 0' }}>Your photo stays on your device. We do not upload it.</p>
          {photoErr && <p role="alert" style={{ color: '#9B1C31', fontSize: 14, margin: '8px 0 0' }}>{photoErr}</p>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
            <button type="button" className="at-btn p" onClick={download}>Download PNG</button>
            {canNative && <button type="button" className="at-btn" onClick={nativeShare}>Share image</button>}
          </div>

          <span className="at-lbl">SHARE THE LINK</span>
          <div className="at-share">
            {links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
            <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
          <p style={{ fontSize: 13, color: '#5F6672', margin: '10px 0 0' }}>Download your flyer first, then attach it to your post. A link cannot carry the image on its own.</p>

          <p style={{ marginTop: 28 }}><a href="/elevation-summit#register" className="at-btn">Register for the Summit</a></p>
        </section>

        <section aria-label="Preview">
          <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={`Flyer preview: ${name.trim() || 'Your name'} will be attending The Elevation Summit`} style={{ width: '100%', height: 'auto', borderRadius: 16, border: '1px solid #e6e3dd', display: 'block', background: '#fff', maxWidth: 560, margin: '0 auto' }} />
        </section>
      </div>
    </main>
  );
}
