'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Facebook, Link2, Linkedin, MessageCircle, RotateCcw, Send, Share2, Twitter } from 'lucide-react';
import RegisterCta from './RegisterCta';
import { DIMS, FONT_FACE_CSS, HOME, deltaToWindow, detectFaceTop, drawFlyer, hitPhoto, photoLayout, photoWindow, type Pos, type SizeId, type TemplateId } from './render';

const URL_PATH = '/elevation-summit/attend';
const SHARE_TEXT = 'I will be attending The Elevation Summit, Thursday 19 November 2026 in Lagos. Make your own flyer and join me:';

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'ticket', label: 'Ticket' },
  { id: 'rise', label: 'Rise' },
  { id: 'cover', label: 'Cover' },
];
const SIZES: { id: SizeId; label: string }[] = [
  { id: 'feed', label: 'Feed 1080x1350' },
  { id: 'story', label: 'Story 1080x1920' },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function AttendClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tpl, setTpl] = useState<TemplateId>('ticket');
  const [size, setSize] = useState<SizeId>('feed');
  const [name, setName] = useState('');
  const [line, setLine] = useState('');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [pos, setPos] = useState<Pos>(HOME);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [photoErr, setPhotoErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('https://joinascentor.com');
  const [canNative, setCanNative] = useState(false);
  const { W, H } = DIMS[size];

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNative('share' in navigator);
    const n = new URLSearchParams(window.location.search).get('n');
    if (n) setName(n.toUpperCase().slice(0, 30));
  }, []);

  // Draws run one at a time and only the newest request is painted, so quick edits never interleave.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(0);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const id = ++latest.current;
    chain.current = chain.current.then(async () => {
      if (id !== latest.current) return;
      await drawFlyer(c, tpl, size, name, line, photo, pos);
    }).catch(() => undefined);
  }, [tpl, size, name, line, photo, pos]);

  const ready = name.trim().length >= 3 && !!photo;

  const onFile = useCallback((f: File | undefined) => {
    setPhotoErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setPhotoErr('Please choose an image file.'); return; }
    if (f.size > 15 * 1024 * 1024) { setPhotoErr('That image is over 15 MB. Please choose a smaller one.'); return; }
    const url = URL.createObjectURL(f);
    loadImage(url).then(async (img) => { await detectFaceTop(img); setPos(HOME); setPhoto(img); }).catch(() => setPhotoErr('We could not read that image.'));
  }, []);

  const win = photoWindow(tpl, size);
  const layout = photo ? photoLayout(tpl, size, { x: 0, y: 0, w: win.w, h: win.h }, photo, pos) : null;
  const range = layout?.range ?? { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const clampPos = (p: Pos): Pos => {
    if (!photo) return p;
    const r = photoLayout(tpl, size, { x: 0, y: 0, w: win.w, h: win.h }, photo, p).range;
    return { zoom: p.zoom, x: Math.max(r.minX, Math.min(r.maxX, p.x)), y: Math.max(r.minY, Math.min(r.maxY, p.y)) };
  };
  const pickTpl = (t: TemplateId) => { setTpl(t); setPos(HOME); };
  const pickSize = (s: SizeId) => { setSize(s); setPos(HOME); };

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H, k: W / rect.width };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    const c = toCanvas(e);
    if (!hitPhoto(tpl, size, c.x, c.y)) return;
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const k = toCanvas(e).k;
    const dl = deltaToWindow(tpl, (e.clientX - d.px) * k, (e.clientY - d.py) * k);
    setPos((p) => clampPos({ ...p, x: d.x + dl.x, y: d.y + dl.y }));
  };
  const onUp = () => { drag.current = null; };

  const toBlob = async () => {
    await chain.current;
    return new Promise<Blob | null>((res) => { if (canvasRef.current) canvasRef.current.toBlob(res, 'image/png'); else res(null); });
  };
  const slug = (name.trim() || 'flyer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fileName = `attending-elevation-summit-${slug}.png`;
  const shareUrl = `${origin}${URL_PATH}`;

  const download = async () => {
    if (!ready) return;
    const blob = await toBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const nativeShare = async () => {
    if (!ready) return;
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
    { label: 'WhatsApp', icon: <MessageCircle size={18} aria-hidden />, href: `https://wa.me/?text=${enc(`${SHARE_TEXT} ${shareUrl}`)}` },
    { label: 'Facebook', icon: <Facebook size={18} aria-hidden />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(SHARE_TEXT)}` },
    { label: 'LinkedIn', icon: <Linkedin size={18} aria-hidden />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` },
    { label: 'X', icon: <Twitter size={18} aria-hidden />, href: `https://twitter.com/intent/tweet?text=${enc(SHARE_TEXT)}&url=${enc(shareUrl)}` },
    { label: 'Telegram', icon: <Send size={18} aria-hidden />, href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(SHARE_TEXT)}` },
  ];
  const copy = async () => {
    if (!ready) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const rx = Math.round(range.maxX - range.minX), ry = Math.round(range.maxY - range.minY);

  return (
    <>
      <main style={{ background: '#FAFAF8', color: '#16171B', padding: 'clamp(5.5rem, 8vw, 7rem) 1.25rem 4rem' }}>
        <style>{`${FONT_FACE_CSS}
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
        .at-share a,.at-share button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #cfcac2;background:#fff;font:inherit;font-weight:600;font-size:14px;text-decoration:none;color:#16171B;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
        .at-share button:disabled,.at-btn:disabled{opacity:.45;cursor:not-allowed}
        .at-btn svg{margin-right:8px}
        .at-range{width:100%;accent-color:#B6502A;height:32px}
        .at-edit{border:1px solid #e6e3dd;border-radius:12px;padding:12px 14px;margin-top:12px;background:#fff}
      `}</style>
        <div style={{ maxWidth: 1100, margin: '0 auto 2rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.18em', color: '#B8892B', margin: 0 }}>THE ELEVATION SUMMIT 2026</p>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 900, lineHeight: 1.05, margin: '10px 0 12px' }}>I will be attending</h1>
          <p style={{ maxWidth: 620, color: '#5F6672', fontSize: 17, lineHeight: 1.6, margin: 0 }}>Make your flyer in a minute. Add your name and photo, move and zoom the photo until it looks right, pick a design and a size, then download it as a PNG and share it. No account needed.</p>
        </div>

        <div className="at-grid">
          <section aria-label="Your details">
            <span className="at-lbl" style={{ marginTop: 0 }}>DESIGN</span>
            <div className="at-seg" role="group" aria-label="Flyer design">
              {TEMPLATES.map((v) => <button key={v.id} type="button" aria-pressed={tpl === v.id} onClick={() => pickTpl(v.id)}>{v.label}</button>)}
            </div>

            <span className="at-lbl">SIZE</span>
            <div className="at-seg" role="group" aria-label="Flyer size">
              {SIZES.map((v) => <button key={v.id} type="button" aria-pressed={size === v.id} onClick={() => pickSize(v.id)}>{v.label}</button>)}
            </div>

            <label className="at-lbl" htmlFor="at-name">YOUR NAME</label>
            <input id="at-name" className="at-in" style={{ textTransform: 'uppercase' }} value={name} minLength={3} maxLength={30} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ADA OKAFOR" autoComplete="name" />

            <label className="at-lbl" htmlFor="at-line">YOUR TITLE (OPTIONAL)</label>
            <input id="at-line" className="at-in" value={line} maxLength={40} onChange={(e) => setLine(e.target.value)} placeholder="Product Designer" />

            <span className="at-lbl">YOUR PHOTO</span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="at-btn" onClick={() => fileRef.current?.click()}>{photo ? 'Change photo' : 'Upload a photo'}</button>
              {photo && <button type="button" className="at-btn" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>}
            </div>
            <p style={{ fontSize: 13, color: '#5F6672', margin: '8px 0 0' }}>Your photo stays on your device. We do not upload it.</p>
            {photoErr && <p role="alert" style={{ color: '#9B1C31', fontSize: 14, margin: '8px 0 0' }}>{photoErr}</p>}

            {photo && (
              <div className="at-edit" aria-label="Edit your photo">
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#5F6672' }}>EDIT YOUR PHOTO</p>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#5F6672' }}>Drag the photo on the flyer, or use the sliders.</p>
                <label htmlFor="at-zoom" style={{ fontSize: 13, fontWeight: 600 }}>Zoom</label>
                <input id="at-zoom" className="at-range" type="range" min={1} max={3} step={0.01} value={pos.zoom}
                  onChange={(e) => setPos((p) => clampPos({ ...p, zoom: Number(e.target.value) }))} />
                <label htmlFor="at-x" style={{ fontSize: 13, fontWeight: 600 }}>Left and right</label>
                <input id="at-x" className="at-range" type="range" min={Math.floor(range.minX)} max={Math.ceil(range.maxX)} step={1}
                  disabled={rx < 1} value={Math.round(layout ? pos.x : 0)} onChange={(e) => setPos((p) => clampPos({ ...p, x: Number(e.target.value) }))} />
                <label htmlFor="at-y" style={{ fontSize: 13, fontWeight: 600 }}>Up and down</label>
                <input id="at-y" className="at-range" type="range" min={Math.floor(range.minY)} max={Math.ceil(range.maxY)} step={1}
                  disabled={ry < 1} value={Math.round(layout ? pos.y : 0)} onChange={(e) => setPos((p) => clampPos({ ...p, y: Number(e.target.value) }))} />
                <button type="button" className="at-btn" style={{ minHeight: 40, marginTop: 8 }} onClick={() => setPos(HOME)}><RotateCcw size={16} aria-hidden />Reset photo</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
              <button type="button" className="at-btn p" onClick={download} disabled={!ready}><Download size={18} aria-hidden />Download PNG</button>
              {canNative && <button type="button" className="at-btn" onClick={nativeShare} disabled={!ready}><Share2 size={18} aria-hidden />Share image</button>}
            </div>
            {!ready && <p role="status" style={{ fontSize: 13, color: '#8a5a1f', margin: '10px 0 0' }}>Add your name and upload your photo to unlock download and sharing.</p>}

            <span className="at-lbl">SHARE THE LINK</span>
            <div className="at-share">
              {links.map((l) => ready
                ? <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">{l.icon}{l.label}</a>
                : <button key={l.label} type="button" disabled>{l.icon}{l.label}</button>)}
              <button type="button" onClick={copy} disabled={!ready}>{copied ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />}{copied ? 'Copied' : 'Copy link'}</button>
            </div>
            <p style={{ fontSize: 13, color: '#5F6672', margin: '10px 0 0' }}>Download your flyer first, then attach it to your post. A link cannot carry the image on its own.</p>
          </section>

          <section aria-label="Preview">
            <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={`Flyer preview: ${name.trim() || 'Your name'} will be attending The Elevation Summit`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ touchAction: photo ? 'pan-y' : 'auto', cursor: photo ? 'grab' : 'default', width: '100%', aspectRatio: `${W} / ${H}`, height: 'auto', borderRadius: 16, border: '1px solid #e6e3dd', display: 'block', background: '#fff', maxWidth: size === 'feed' ? 560 : 400, margin: '0 auto' }} />
          </section>
        </div>
      </main>
      <RegisterCta />
    </>
  );
}
