// Canvas renderer for the three "I will be attending" templates (Ticket, Rise, Cover), Feed and Story.
// Layout values come from the supplied LAYER-SPEC.md and reference HTML. Everything is drawn client-side.

export type TemplateId = 'ticket' | 'rise' | 'cover';
export type SizeId = 'feed' | 'story';
export type Pos = { zoom: number; x: number; y: number };
export const HOME: Pos = { zoom: 1, x: 0, y: 0 };

export const DIMS: Record<SizeId, { W: number; H: number }> = { feed: { W: 1080, H: 1350 }, story: { W: 1080, H: 1920 } };

const NIGHT = '#080808';
const RUST = '#B6502A';
const GOLD = '#CAA228';
const PAPER = '#FBF8F1';
const DETAILS = [
  ['DATE', 'Thu 19 Nov 2026'],
  ['TIME', '10:00 AM WAT'],
  ['ENTRY', 'Free'],
  ['VENUE', 'Aderemi Makanjuola Hall, Lagos State University, Ojo, Lagos'],
] as const;
const VENUE_LONG = 'Aderemi Makanjuola Hall, Lagos State University, Ojo, Lagos';
const URL_SHORT = 'joinascentor.com/elevation-summit';

const POPPINS = 'Poppins, system-ui, sans-serif';
const METRO = 'Metropolis, system-ui, sans-serif';
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const FONT_FACE_CSS = `
@font-face{font-family:'Poppins';font-weight:600;font-display:block;src:url(/fonts/attend/poppins-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Poppins';font-weight:700;font-display:block;src:url(/fonts/attend/poppins-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Poppins';font-weight:800;font-display:block;src:url(/fonts/attend/poppins-latin-800-normal.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:700;font-display:block;src:url(/fonts/attend/ibm-plex-mono-latin-700-normal.woff2) format('woff2')}`;

export async function loadFonts() {
  const specs = ['600 20px Poppins', '700 20px Poppins', '800 20px Poppins', '600 20px Metropolis', '700 20px Metropolis', "700 20px 'IBM Plex Mono'"];
  try { await Promise.all(specs.map((s) => document.fonts.load(s, 'AaBb0123'))); } catch { /* falls back to system fonts */ }
}

// ---------------------------------------------------------------------------------------------------------------------
// Images, patterns
// ---------------------------------------------------------------------------------------------------------------------
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadLogo(src: string) {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}
const LOGO_RATIO = 101.16 / 380.8;
const LOGO_LIGHT = '/ascentor-color-for-light-pages.svg';
const LOGO_DARK = '/ascentor-color-for-dark-pages.svg';

let grainTile: HTMLCanvasElement | null = null;
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const n = 256;
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const g = c.getContext('2d')!;
  const d = g.createImageData(n, n);
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n * n; i++) {
    const v = (rnd() + rnd() + rnd()) / 3; // soft noise around 0.5, like fractal noise
    d.data[i * 4] = 89; d.data[i * 4 + 1] = 71; d.data[i * 4 + 2] = 51;
    d.data[i * 4 + 3] = Math.min(255, v * 0.55 * 255 * 1.3);
  }
  g.putImageData(d, 0, 0);
  grainTile = c;
  return c;
}
let dotTile: HTMLCanvasElement | null = null;
function dots(): HTMLCanvasElement {
  if (dotTile) return dotTile;
  const c = document.createElement('canvas');
  c.width = 26; c.height = 26;
  const g = c.getContext('2d')!;
  g.fillStyle = '#E3E3E3'; g.fillRect(0, 0, 26, 26);
  g.fillStyle = '#D4D4D4'; g.beginPath(); g.arc(13, 13, 2, 0, Math.PI * 2); g.fill();
  dotTile = c;
  return c;
}

// ---------------------------------------------------------------------------------------------------------------------
// Text helpers (all text is drawn left-aligned from a computed x so letter-spacing is handled the same way as CSS)
// ---------------------------------------------------------------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;
const font = (w: number, size: number, fam: string) => `${w} ${size}px ${fam}`;

function setLS(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}
function hasLS(ctx: Ctx) { return 'letterSpacing' in ctx; }

/** Width of text including CSS-style trailing letter-spacing. */
function tw(ctx: Ctx, text: string, f: string, ls: number) {
  ctx.font = f;
  if (hasLS(ctx)) { setLS(ctx, ls); const w = ctx.measureText(text).width; setLS(ctx, 0); return w; }
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + ls;
  return w;
}
/** Height of CSS `line-height: normal` for a font. */
function normalLH(ctx: Ctx, f: string) {
  ctx.font = f;
  const m = ctx.measureText('Hg');
  return (m.fontBoundingBoxAscent ?? 0) + (m.fontBoundingBoxDescent ?? 0) || parseFloat(f.split('px')[0].split(' ').pop() || '16') * 1.3;
}
type TOpts = { f: string; ls?: number; color: string; align?: 'left' | 'center' | 'right'; lh?: number; shadow?: string };
/** Draw one line in a line box whose top is `top` and height `lh`. `x` is the left / centre / right anchor. Returns width. */
function line(ctx: Ctx, text: string, x: number, top: number, o: TOpts) {
  const ls = o.ls ?? 0;
  const w = tw(ctx, text, o.f, ls);
  const lh = o.lh ?? normalLH(ctx, o.f);
  ctx.font = o.f;
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? parseFloat(o.f.split('px')[0].split(' ').pop() || '16') * 0.95;
  const desc = m.fontBoundingBoxDescent ?? asc * 0.3;
  const base = top + (lh - (asc + desc)) / 2 + asc;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (hasLS(ctx)) {
    setLS(ctx, ls);
    ctx.fillText(text, x0, base);
    setLS(ctx, 0);
  } else {
    let cx = x0;
    for (const ch of text) { ctx.fillText(ch, cx, base); cx += ctx.measureText(ch).width + ls; }
  }
  return w;
}

function wrapLines(ctx: Ctx, text: string, f: string, ls: number, maxW: number) {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && tw(ctx, t, f, ls) > maxW) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

// fitName: one line at base, scale down to 60%, then two balanced lines at 60%, then shrink 1px at a time.
export type NameFit = { size: number; lines: string[]; lh: number; height: number };
export function fitName(ctx: Ctx, text: string, maxW: number, base: number, min = 0.6, weight = 800, lsEm = -0.02): NameFit {
  const wAt = (t: string, s: number) => tw(ctx, t, font(weight, s, POPPINS), lsEm * s);
  const w1 = wAt(text, base);
  if (w1 <= maxW) return { size: base, lines: [text], lh: base, height: base };
  const s = (base * maxW) / w1;
  if (s >= base * min) return { size: s, lines: [text], lh: s, height: s };
  // two balanced lines at 60%; a break is allowed at a space or after a hyphen
  const m = base * min;
  const breaks: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') breaks.push(i);
    else if (text[i] === '-' && i < text.length - 1) breaks.push(i + 1);
  }
  let best: string[] | null = null;
  let bestW = Infinity;
  for (const b of breaks) {
    const a = text.slice(0, b).trim();
    const c = text.slice(b).trim();
    if (!a || !c) continue;
    const mw = Math.max(wAt(a, m), wAt(c, m));
    if (mw < bestW) { bestW = mw; best = [a, c]; }
  }
  const lines = best ?? [text];
  let f = m;
  const fits = (sz: number) => Math.max(...lines.map((l) => wAt(l, sz))) <= maxW;
  while (!fits(f) && f > 8) f -= 1;
  const lh = lines.length > 1 ? f * 1.02 : f;
  return { size: f, lines, lh, height: lh * lines.length };
}

export type TitleFit = { size: number; text: string };
export function fitTitle(ctx: Ctx, text: string, maxW: number, base: number, min = 0.5, weight = 600): TitleFit {
  const wAt = (t: string, s: number) => tw(ctx, t, font(weight, s, METRO), 0);
  const w = wAt(text, base);
  if (w <= maxW) return { size: base, text };
  const s = Math.max(base * min, (base * maxW) / w);
  if (wAt(text, s) <= maxW) return { size: s, text };
  let t = text;
  while (t.length > 1 && wAt(`${t.trimEnd()}…`, s) > maxW) t = t.slice(0, -1);
  return { size: s, text: `${t.trimEnd()}…` };
}

function barcode(ctx: Ctx, x: number, y: number, w: number, h: number) {
  let s = 7; let px = 0;
  ctx.fillStyle = '#111';
  while (px < w) {
    s = (s * 9301 + 49297) % 233280;
    const b = 2 + Math.floor((5 * s) / 233280);
    if (s & 3) ctx.fillRect(x + px, y, Math.min(b, w - px), h);
    px += b + 2;
  }
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------------------------------------------------------------
// Photo placement and editing
// ---------------------------------------------------------------------------------------------------------------------
export type Win = { x: number; y: number; w: number; h: number };
const FACE_TOP = 0.2; // default (no face detection): top of head at 20% of the photo height
/** Per-photo top-of-head fraction, filled in when the browser offers face detection. */
export const faceTops = new WeakMap<HTMLImageElement, number>();
/** Best-effort face detection (Shape Detection API where it exists). Nothing is uploaded; failures keep the 0.2 default. */
export async function detectFaceTop(img: HTMLImageElement) {
  try {
    const FD = (window as unknown as { FaceDetector?: new (o: object) => { detect: (i: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
    if (!FD) return;
    const faces = await new FD({ fastMode: true, maxDetectedFaces: 1 }).detect(img);
    if (!faces.length) return;
    const b = faces[0].boundingBox;
    const top = (b.y - b.height * 0.45) / img.height; // hair sits above the detected face box
    faceTops.set(img, Math.min(0.45, Math.max(0.03, top)));
  } catch { /* keep the default */ }
}
const FACE_Y: Record<SizeId, number> = { feed: 330, story: 520 };

/** Where the photo sits relative to its window (window-local px), before the user's offset. */
function baseRect(tpl: TemplateId, size: SizeId, win: Win, iw: number, ih: number, zoom: number, faceTop: number) {
  let s = Math.max(win.w / iw, win.h / ih);
  if (tpl === 'cover') {
    const need = FACE_Y[size] / (faceTop * ih);
    if (s < need) s = need;
  }
  s *= zoom;
  const w = iw * s, h = ih * s;
  const x = (win.w - w) / 2;
  let y: number;
  if (tpl === 'cover') y = FACE_Y[size] - faceTop * h;
  else y = -(h - win.h) * 0.33; // object-position: 50% 33%
  y = Math.min(0, Math.max(win.h - h, y));
  return { x, y, w, h };
}

/** The final rect plus the allowed offset range, so the photo always covers its window. */
export function photoLayout(tpl: TemplateId, size: SizeId, win: Win, photo: HTMLImageElement, pos: Pos) {
  const b = baseRect(tpl, size, win, photo.width, photo.height, pos.zoom, faceTops.get(photo) ?? FACE_TOP);
  const minX = win.w - b.w - b.x, maxX = -b.x;
  const minY = win.h - b.h - b.y, maxY = -b.y;
  const ox = Math.max(minX, Math.min(maxX, pos.x));
  const oy = Math.max(minY, Math.min(maxY, pos.y));
  return { x: b.x + ox, y: b.y + oy, w: b.w, h: b.h, range: { minX, maxX, minY, maxY } };
}

export function photoWindow(tpl: TemplateId, size: SizeId): Win {
  const { W, H } = DIMS[size];
  if (tpl === 'ticket') return { x: 48, y: 244, w: 384, h: 480 }; // ticket-local
  if (tpl === 'rise') {
    const a = size === 'feed' ? { cx: 780, w: 380, top: 170, bottom: 640 } : { cx: 770, w: 440, top: 390, bottom: 960 };
    return { x: a.cx - a.w / 2, y: a.top, w: a.w, h: a.bottom - a.top };
  }
  return { x: 0, y: 0, w: W, h: H };
}

const TICKET = { w: 960, h: 1060, body: 760, radius: 26, rot: (-3 * Math.PI) / 180 };
const TICKET_C: Record<SizeId, { cx: number; cy: number }> = { feed: { cx: 540, cy: 680 }, story: { cx: 540, cy: 960 } };

/** Convert a canvas point to the photo window's local space (undoes the ticket rotation). */
export function toWindowSpace(tpl: TemplateId, size: SizeId, px: number, py: number) {
  if (tpl === 'ticket') {
    const c = TICKET_C[size];
    const dx = px - c.cx, dy = py - c.cy;
    const cos = Math.cos(-TICKET.rot), sin = Math.sin(-TICKET.rot);
    return { x: dx * cos - dy * sin + TICKET.w / 2, y: dx * sin + dy * cos + TICKET.h / 2 };
  }
  return { x: px, y: py };
}
/** Rotate a canvas-space drag delta into window-local space. */
export function deltaToWindow(tpl: TemplateId, dx: number, dy: number) {
  if (tpl !== 'ticket') return { x: dx, y: dy };
  const cos = Math.cos(-TICKET.rot), sin = Math.sin(-TICKET.rot);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}
export function hitPhoto(tpl: TemplateId, size: SizeId, px: number, py: number) {
  const p = toWindowSpace(tpl, size, px, py);
  const w = photoWindow(tpl, size);
  if (tpl === 'cover') return true;
  return p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h;
}

function drawPhoto(ctx: Ctx, tpl: TemplateId, size: SizeId, win: Win, photo: HTMLImageElement | null, pos: Pos, placeholder: string, label: string) {
  // The ctx must already be clipped to the window shape. Coordinates here are window-space (absolute for rise and cover).
  if (!photo) {
    ctx.fillStyle = placeholder;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    if (label) line(ctx, label, win.x + win.w / 2, win.y + win.h / 2 - 20, { f: font(700, 26, POPPINS), ls: 3, color: 'rgba(120,120,120,.85)', align: 'center', lh: 40 });
    return;
  }
  const L = photoLayout(tpl, size, { x: 0, y: 0, w: win.w, h: win.h }, photo, pos);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(photo, win.x + L.x, win.y + L.y, L.w, L.h);
}

// ---------------------------------------------------------------------------------------------------------------------
// Template 1: Ticket
// ---------------------------------------------------------------------------------------------------------------------
async function drawTicket(ctx: Ctx, size: SizeId, name: string, title: string, photo: HTMLImageElement | null, pos: Pos) {
  const { W, H } = DIMS[size];
  // background: dots and paper grain at 25%
  ctx.fillStyle = ctx.createPattern(dots(), 'repeat')!;
  ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = ctx.createPattern(grain(), 'repeat')!; ctx.fillRect(0, 0, W, H); ctx.restore();

  const c = TICKET_C[size];
  const { w: cw, h: ch, body, radius } = TICKET;
  const logo = await loadLogo(LOGO_LIGHT);

  const shape = () => {
    ctx.beginPath();
    ctx.roundRect(0, 0, cw, ch, radius);
    ctx.moveTo(body + 24, 0); ctx.arc(body, 0, 24, 0, Math.PI * 2);
    ctx.moveTo(body + 24, ch); ctx.arc(body, ch, 24, 0, Math.PI * 2);
  };

  ctx.save();
  ctx.translate(c.cx, c.cy);
  ctx.rotate(TICKET.rot);
  ctx.translate(-cw / 2, -ch / 2);
  // two soft shadows
  for (const [oy, blur, a] of [[34, 34, 0.2], [6, 8, 0.12]] as const) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy;
    ctx.fillStyle = PAPER;
    shape(); ctx.fill('evenodd');
    ctx.restore();
  }
  // everything inside the ticket is clipped to the shape (with the notches cut out)
  shape(); ctx.clip('evenodd');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, cw, ch);
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.createPattern(grain(), 'repeat')!; ctx.fillRect(0, 0, cw, ch); ctx.restore();

  if (logo) ctx.drawImage(logo, 48, 50, 200, 200 * LOGO_RATIO);
  line(ctx, 'THE ELEVATION SUMMIT', body - 48, 62, { f: font(800, 26, POPPINS), ls: 2.6, color: '#000', align: 'right' });

  ctx.fillStyle = RUST; ctx.fillRect(0, 136, body, 70);
  line(ctx, 'ADMIT ONE · I’M ATTENDING', body / 2 + 3.75, 136, { f: font(700, 25, POPPINS), ls: 7.5, color: '#fff', align: 'center', lh: 70 });

  // photo window + gold border
  const pw = { x: 48, y: 244, w: 384, h: 480 };
  ctx.save();
  rr(ctx, pw.x, pw.y, pw.w, pw.h, 28); ctx.clip();
  drawPhoto(ctx, 'ticket', size, pw, photo, pos, '#DDDDDD', 'YOUR PHOTO');
  ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  rr(ctx, pw.x + 9 + 1.5, pw.y + 9 + 1.5, pw.w - 18 - 3, pw.h - 18 - 3, 19 - 1.5); ctx.stroke();

  // details
  let dy = 244;
  DETAILS.forEach(([label, value], i) => {
    if (i) dy += 16;
    const lf = font(700, 16, MONO);
    const lH = normalLH(ctx, lf);
    line(ctx, label, 470, dy, { f: lf, ls: 3.2, color: '#8A8170', lh: lH });
    dy += lH + 6;
    const vs = i < 3 ? 30 : 23;
    const vf = font(700, vs, POPPINS);
    const vl = wrapLines(ctx, value, vf, 0, 242);
    for (const l of vl) { line(ctx, l, 470, dy, { f: vf, color: '#111', lh: vs * 1.22 }); dy += vs * 1.22; }
    dy += 16;
    if (i < 3) { ctx.fillStyle = '#E4DCCB'; ctx.fillRect(470, dy, 242, 2); dy += 2; }
  });

  // name box 48,760 664x150, content vertically centred
  const nb = { x: 48, y: 760, w: 664, h: 150 };
  const nf = fitName(ctx, name, nb.w, 70, 0.6);
  const tf = title ? fitTitle(ctx, title, nb.w, 30, 0.5) : null;
  const tH = tf ? normalLH(ctx, font(600, tf.size, METRO)) : 0;
  const contentH = nf.height + (tf ? 10 + tH : 0);
  let ty = nb.y + (nb.h - contentH) / 2;
  for (const l of nf.lines) { line(ctx, l, nb.x, ty, { f: font(800, nf.size, POPPINS), ls: -0.02 * nf.size, color: '#000', lh: nf.lh }); ty += nf.lh; }
  if (tf) line(ctx, tf.text, nb.x, ty + 10, { f: font(600, tf.size, METRO), color: '#6B7280', lh: tH });

  ctx.fillStyle = GOLD; ctx.fillRect(48, 930, 120, 3);
  line(ctx, 'THE RISE WE CHOOSE', 48, 950, { f: font(800, 46, POPPINS), ls: -0.92, color: '#000' });

  // perforation
  ctx.save();
  ctx.strokeStyle = '#C9BFAA'; ctx.lineWidth = 4; ctx.lineCap = 'butt'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(body + 1, 34); ctx.lineTo(body + 1, ch - 34); ctx.stroke();
  ctx.restore();

  // stub: 940x160 box rotated 90deg about the stub centre
  ctx.save();
  ctx.translate(body + 100, ch / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-470, -80);
  const sf = font(800, 28, POPPINS);
  const uf = font(700, 20, MONO);
  const sH = normalLH(ctx, sf), uH = normalLH(ctx, uf);
  const gap = (160 - sH - 58 - uH) / 2;
  line(ctx, 'THE ELEVATION SUMMIT · 19.11.26', 470, 0, { f: sf, ls: 3.92, color: '#000', align: 'center', lh: sH });
  barcode(ctx, 470 - 280, sH + gap, 560, 58);
  line(ctx, URL_SHORT, 470, 160 - uH, { f: uf, ls: 0.8, color: '#333', align: 'center', lh: uH });
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// Template 2: Rise
// ---------------------------------------------------------------------------------------------------------------------
type RiseLayout = {
  logo: { x: number; y: number; w: number };
  wm: { right: number; y: number };
  arch: { cx: number; w: number; top: number; bottom: number };
  landing: { x: number; w: number; top: number; h: number; depth: number };
  steps: { x: number; w: number; top: number }[];
  stepH: number; pad: number; nameSize: number; titleSize: number;
  band: { x: number; y: number; rise: number; line: number; gap: number };
};
const RISE: Record<SizeId, RiseLayout> = {
  feed: { logo: { x: 60, y: 56, w: 230 }, wm: { right: 60, y: 70 }, arch: { cx: 780, w: 380, top: 170, bottom: 640 }, landing: { x: 520, w: 520, top: 640, h: 210, depth: 26 }, steps: [{ x: 330, w: 240, top: 730 }, { x: 180, w: 240, top: 820 }, { x: 30, w: 240, top: 910 }, { x: -120, w: 240, top: 1000 }], stepH: 62, pad: 28, nameSize: 64, titleSize: 26, band: { x: 60, y: 1112, rise: 40, line: 25, gap: 8 } },
  story: { logo: { x: 60, y: 262, w: 230 }, wm: { right: 60, y: 276 }, arch: { cx: 770, w: 440, top: 390, bottom: 960 }, landing: { x: 480, w: 560, top: 960, h: 230, depth: 28 }, steps: [{ x: 300, w: 250, top: 1070 }, { x: 160, w: 250, top: 1180 }, { x: 20, w: 250, top: 1290 }, { x: -120, w: 250, top: 1400 }], stepH: 70, pad: 30, nameSize: 70, titleSize: 28, band: { x: 60, y: 1484, rise: 42, line: 26, gap: 8 } },
};
const WORDS = ['RISE', 'TO', 'CHOOSING', 'I’M'];

function glow(ctx: Ctx, bx: number, by: number, bw: number, bh: number, cxp: number, cyp: number, stops: [number, string][]) {
  ctx.save();
  ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.translate(bx + bw * cxp, by + bh * cyp);
  ctx.scale(bw / 2, bh / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function block(ctx: Ctx, x: number, w: number, top: number, h: number, d: number, inner: () => void) {
  // top face
  const tg = ctx.createLinearGradient(0, top - d, 0, top);
  tg.addColorStop(0, '#D06C43'); tg.addColorStop(1, '#C8623A');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(x + d, top - d); ctx.lineTo(x + w + d, top - d); ctx.lineTo(x + w, top); ctx.lineTo(x, top); ctx.closePath(); ctx.fill();
  // gold tread edge
  ctx.fillStyle = GOLD; ctx.fillRect(x, top - 2, w, 3);
  // side face
  ctx.fillStyle = '#8E3C1E';
  ctx.beginPath(); ctx.moveTo(x + w, top); ctx.lineTo(x + w + d, top - d); ctx.lineTo(x + w + d, top + h - d); ctx.lineTo(x + w, top + h); ctx.closePath(); ctx.fill();
  // front face
  const fg = ctx.createLinearGradient(0, top, 0, top + h);
  fg.addColorStop(0, RUST); fg.addColorStop(1, '#A9482A');
  ctx.fillStyle = fg; ctx.fillRect(x, top, w, h);
  inner();
}

async function drawRise(ctx: Ctx, size: SizeId, name: string, title: string, photo: HTMLImageElement | null, pos: Pos) {
  const { W, H } = DIMS[size];
  const L = RISE[size];
  const a = L.arch, ar = a.w / 2, ld = L.landing;
  ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, W, H);
  // top glow
  glow(ctx, -200, -400, W + 400, H * 0.75, 0.5, 0.3, [[0, 'rgba(255,190,120,.20)'], [0.55, 'rgba(255,170,100,.06)'], [0.75, 'rgba(255,170,100,0)']]);
  // arch glow
  glow(ctx, a.cx - a.w, a.top - 80, a.w * 2, a.bottom - a.top + 160, 0.5, 0.45, [[0, 'rgba(255,180,110,.32)'], [0.5, 'rgba(255,160,90,.10)'], [0.72, 'rgba(255,160,90,0)']]);

  const logo = await loadLogo(LOGO_DARK);
  if (logo) ctx.drawImage(logo, L.logo.x, L.logo.y, L.logo.w, L.logo.w * LOGO_RATIO);
  line(ctx, 'THE ELEVATION SUMMIT', W - L.wm.right, L.wm.y, { f: font(800, 24, POPPINS), ls: 3.36, color: '#fff', align: 'right' });

  // arch photo
  const win = { x: a.cx - ar, y: a.top, w: a.w, h: a.bottom - a.top };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(win.x, a.bottom); ctx.lineTo(win.x, a.top + ar); ctx.arc(a.cx, a.top + ar, ar, Math.PI, 0); ctx.lineTo(win.x + win.w, a.bottom); ctx.closePath();
  ctx.clip();
  drawPhoto(ctx, 'rise', size, win, photo, pos, '#222222', 'YOUR PHOTO');
  ctx.restore();
  // outline (no bottom edge)
  ctx.save();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  const orad = ar + 8 - 1.5;
  ctx.beginPath();
  ctx.moveTo(a.cx - orad, a.bottom); ctx.lineTo(a.cx - orad, a.top - 8 + 1.5 + orad); ctx.arc(a.cx, a.top - 8 + 1.5 + orad, orad, Math.PI, 0); ctx.lineTo(a.cx + orad, a.bottom);
  ctx.stroke();
  ctx.restore();

  // steps, back (step 4) to front, then the landing
  const dStep = Math.round(ld.depth * 0.8);
  for (let i = 3; i >= 0; i--) {
    const s = L.steps[i];
    const fs = Math.round(L.stepH * 0.36);
    block(ctx, s.x, s.w, s.top, L.stepH, dStep, () => {
      const f = font(700, fs, POPPINS);
      const padL = s.x < 0 ? -s.x : 0;
      const cx = s.x + padL + (s.w - padL) / 2;
      line(ctx, WORDS[i], cx, s.top, { f, ls: 0.32 * fs, color: '#fff', align: 'center', lh: L.stepH });
    });
  }
  block(ctx, ld.x, ld.w, ld.top, ld.h, ld.depth, () => {
    const maxW = ld.w - 2 * L.pad;
    const nf = fitName(ctx, name, maxW, L.nameSize, 0.6);
    const tf = title ? fitTitle(ctx, title, maxW, L.titleSize, 0.5) : null;
    const tH = tf ? normalLH(ctx, font(600, tf.size, METRO)) : 0;
    const contentH = nf.height + (tf ? 10 + tH : 0);
    const areaTop = ld.top + L.pad * 0.6, areaH = ld.h - L.pad * 1.2;
    let ty = areaTop + (areaH - contentH) / 2;
    const cx = ld.x + ld.w / 2;
    for (const l of nf.lines) { line(ctx, l, cx, ty, { f: font(800, nf.size, POPPINS), ls: -0.02 * nf.size, color: '#fff', align: 'center', lh: nf.lh }); ty += nf.lh; }
    if (tf) line(ctx, tf.text, cx, ty + 10, { f: font(600, tf.size, METRO), color: '#F1DDD2', align: 'center', lh: tH });
  });

  // bottom text block
  const b = L.band;
  ctx.fillStyle = GOLD; ctx.fillRect(b.x, b.y, 110, 3);
  let y = b.y + 3 + 22;
  line(ctx, 'THE RISE WE CHOOSE', b.x, y, { f: font(800, b.rise, POPPINS), ls: -0.02 * b.rise, color: '#fff', lh: b.rise });
  y += b.rise + 16;
  const lf7 = font(700, b.line, METRO), lf6 = font(600, b.line, METRO);
  const lH = normalLH(ctx, lf7);
  line(ctx, 'Thu 19 Nov 2026 · 10:00 AM WAT', b.x, y, { f: lf7, color: '#fff', lh: lH }); y += lH + b.gap;
  line(ctx, VENUE_LONG, b.x, y, { f: lf6, color: '#D8D3CA', lh: lH }); y += lH + b.gap;
  line(ctx, `Free · ${URL_SHORT}`, b.x, y, { f: lf7, color: '#fff', lh: lH });
}

// ---------------------------------------------------------------------------------------------------------------------
// Template 3: Cover
// ---------------------------------------------------------------------------------------------------------------------
type CoverLayout = {
  logo: { x: number; y: number; w: number }; issue: { right: number; y: number; size: number };
  mast: { x: number; y: number; size: number; lh: number };
  sticker: { cx: number; cy: number; d: number; rot: number };
  lines: { x: number; w: number; bottom: number };
  name: number; title: number; head: number; label: number;
  strip: { y: number; size: number }; barcode: { w: number; h: number; right: number; bottom: number };
  gradTop: number; topGrad: number;
};
const COVER: Record<SizeId, CoverLayout> = {
  feed: { logo: { x: 56, y: 50, w: 170 }, issue: { right: 56, y: 62, size: 19 }, mast: { x: 48, y: 104, size: 172, lh: 0.84 }, sticker: { cx: 868, cy: 690, d: 230, rot: -12 }, lines: { x: 60, w: 760, bottom: 1206 }, name: 96, title: 32, head: 38, label: 20, strip: { y: 1240, size: 18 }, barcode: { w: 170, h: 46, right: 56, bottom: 30 }, gradTop: 0.48, topGrad: 0.22 },
  story: { logo: { x: 56, y: 262, w: 170 }, issue: { right: 56, y: 274, size: 19 }, mast: { x: 48, y: 318, size: 172, lh: 0.84 }, sticker: { cx: 868, cy: 1010, d: 250, rot: -12 }, lines: { x: 60, w: 780, bottom: 1520 }, name: 100, title: 34, head: 42, label: 22, strip: { y: 1556, size: 19 }, barcode: { w: 180, h: 50, right: 56, bottom: 258 }, gradTop: 0.5, topGrad: 0.26 },
};

async function drawCover(ctx: Ctx, size: SizeId, name: string, title: string, photo: HTMLImageElement | null, pos: Pos) {
  const { W, H } = DIMS[size];
  const L = COVER[size];
  ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, W, H);
  if (photo) {
    ctx.save();
    ctx.filter = 'sepia(.14) saturate(1.06) contrast(1.04) brightness(.97)';
    drawPhoto(ctx, 'cover', size, { x: 0, y: 0, w: W, h: H }, photo, pos, '#444', '');
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8A8174'); g.addColorStop(1, '#2A2622');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    line(ctx, 'YOUR PHOTO', W / 2, H * 0.42, { f: font(700, 30, POPPINS), ls: 4, color: 'rgba(255,255,255,.55)', align: 'center', lh: 44 });
  }
  const tg = ctx.createLinearGradient(0, 0, 0, H * L.topGrad);
  tg.addColorStop(0, 'rgba(0,0,0,.42)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * L.topGrad);

  // masthead
  const mf = font(800, L.mast.size, POPPINS);
  const mlh = L.mast.size * L.mast.lh;
  line(ctx, 'THE RISE', L.mast.x, L.mast.y, { f: mf, ls: -0.055 * L.mast.size, color: '#fff', lh: mlh });
  line(ctx, 'WE CHOOSE', L.mast.x, L.mast.y + mlh, { f: mf, ls: -0.055 * L.mast.size, color: '#fff', lh: mlh });

  const by = H * L.gradTop;
  const bg = ctx.createLinearGradient(0, by, 0, H);
  bg.addColorStop(0, 'rgba(8,8,8,0)'); bg.addColorStop(0.38, 'rgba(8,8,8,.55)'); bg.addColorStop(0.7, 'rgba(8,8,8,.88)'); bg.addColorStop(1, 'rgba(8,8,8,.94)');
  ctx.fillStyle = bg; ctx.fillRect(0, by, W, H - by);

  const logo = await loadLogo(LOGO_DARK);
  if (logo) ctx.drawImage(logo, L.logo.x, L.logo.y, L.logo.w, L.logo.w * LOGO_RATIO);
  line(ctx, 'THE ELEVATION SUMMIT · ISSUE 19.11.26', W - L.issue.right, L.issue.y, { f: font(700, L.issue.size, POPPINS), ls: 0.24 * L.issue.size, color: '#fff', align: 'right' });

  // sticker
  const s = L.sticker;
  ctx.save();
  ctx.translate(s.cx, s.cy); ctx.rotate((s.rot * Math.PI) / 180);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = RUST; ctx.beginPath(); ctx.arc(0, 0, s.d / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.arc(0, 0, s.d / 2 - 10 - 1, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const s1 = s.d * 0.15, s2 = s.d * 0.13;
  const hh = s1 + s2 * 1.05;
  let sy = -hh / 2;
  line(ctx, 'I’M', 0, sy, { f: font(800, s1, POPPINS), color: '#fff', align: 'center', lh: s1 }); sy += s1;
  line(ctx, 'ATTENDING', 0, sy, { f: font(800, s2, POPPINS), ls: 0.02 * s2, color: '#fff', align: 'center', lh: s2 * 1.05 });
  ctx.restore();

  // cover-lines block, laid out from the bottom up
  const nf = fitName(ctx, name, L.lines.w, L.name, 0.6, 800, -0.025);
  const tf = title ? fitTitle(ctx, title, L.lines.w, L.title, 0.5) : null;
  const lf = font(700, L.label, POPPINS);
  const labH = normalLH(ctx, lf);
  const tH = tf ? normalLH(ctx, font(600, tf.size, METRO)) : 0;
  const headH = L.head * 1.2;
  const total = labH + 14 + nf.height + (tf ? 12 + tH : 0) + 22 + headH;
  let y = L.lines.bottom - total;
  line(ctx, 'COVER STORY', L.lines.x, y, { f: lf, ls: 0.28 * L.label, color: GOLD, lh: labH }); y += labH + 14;
  for (const l of nf.lines) { line(ctx, l, L.lines.x, y, { f: font(800, nf.size, POPPINS), ls: -0.025 * nf.size, color: '#fff', lh: nf.lh }); y += nf.lh; }
  if (tf) { line(ctx, tf.text, L.lines.x, y + 12, { f: font(600, tf.size, METRO), color: '#EDE6DC', lh: tH }); y += 12 + tH; }
  line(ctx, 'Chose to rise. Will be in the room.', L.lines.x, y + 22, { f: font(700, L.head, METRO), color: '#fff', lh: headH });

  // bottom strip
  const sw = W - 60 - (L.barcode.right + L.barcode.w + 30);
  ctx.fillStyle = GOLD; ctx.fillRect(60, L.strip.y, sw, 2);
  const stf = font(600, L.strip.size, METRO);
  const strip = `Thu 19 Nov 2026 · 10:00 AM WAT · ${VENUE_LONG} · Free · ${URL_SHORT}`;
  let sty = L.strip.y + 2 + 14;
  for (const l of wrapLines(ctx, strip, stf, 0, sw)) { line(ctx, l, 60, sty, { f: stf, color: '#fff', lh: L.strip.size * 1.45 }); sty += L.strip.size * 1.45; }

  // barcode plate
  const bw = L.barcode.w, bh = L.barcode.h;
  const bx = W - L.barcode.right - bw, byy = H - L.barcode.bottom - bh;
  ctx.fillStyle = '#fff'; rr(ctx, bx, byy, bw, bh, 4); ctx.fill();
  barcode(ctx, bx + 10, byy + 8, bw - 20, bh - 16);
}

// ---------------------------------------------------------------------------------------------------------------------
export async function drawFlyer(canvas: HTMLCanvasElement, tpl: TemplateId, size: SizeId, nameRaw: string, titleRaw: string, photo: HTMLImageElement | null, pos: Pos) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await loadFonts();
  const { W, H } = DIMS[size];
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const name = (nameRaw.trim() || 'YOUR NAME').toUpperCase().slice(0, 30);
  const title = titleRaw.trim().slice(0, 40);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (tpl === 'ticket') await drawTicket(ctx, size, name, title, photo, pos);
  else if (tpl === 'rise') await drawRise(ctx, size, name, title, photo, pos);
  else await drawCover(ctx, size, name, title, photo, pos);
  ctx.restore();
}
