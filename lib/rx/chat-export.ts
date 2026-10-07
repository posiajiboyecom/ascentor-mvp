import 'server-only';
// lib/rx/chat-export.ts
// Turns chat transcripts into a plain-text file or a PDF (Metropolis, A4, page numbers). Used by the admin chat
// viewer. Nothing is stored: files are built in memory and streamed to the admin who asked.

import PDFDocument from 'pdfkit';
import * as path from 'path';
import type { Transcript } from './chats';

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts', 'metropolis');
const NOTO_DIR = path.join(process.cwd(), 'public', 'fonts', 'noto');
const INK = '#0F0F0E';
const MUTED = '#6B7280';
const GOLD = '#8A6A2B';
const RULE = '#E8E6E1';

const stamp = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

export interface ExportMeta { exportedBy: string; exportedAt: string; from?: string; to?: string }

export function toText(transcripts: Transcript[], meta: ExportMeta): string {
  const out: string[] = [];
  out.push('ASCENTOR: CHAT EXPORT');
  out.push(`Exported by ${meta.exportedBy} on ${stamp(meta.exportedAt)}`);
  if (meta.from || meta.to) out.push(`Date range: ${meta.from ?? 'start'} to ${meta.to ?? 'now'}`);
  out.push('Confidential. Contains members’ private messages. Handle under the privacy policy.');
  for (const t of transcripts) {
    out.push('', '='.repeat(72), t.title, t.subtitle, `${t.lines.length} messages${t.truncated ? ' (truncated: more exist)' : ''}`, '='.repeat(72), '');
    for (const l of t.lines) out.push(`[${stamp(l.at)}] ${l.who}: ${l.text}`);
  }
  return out.join('\n') + '\n';
}

export function toPdf(transcripts: Transcript[], meta: ExportMeta): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true, info: { Title: 'Ascentor chat export', Author: 'Ascentor' } });
    doc.registerFont('R', path.join(FONT_DIR, 'Metropolis-Regular.otf'));
    doc.registerFont('B', path.join(FONT_DIR, 'Metropolis-Bold.otf'));
    doc.registerFont('S', path.join(FONT_DIR, 'Metropolis-SemiBold.otf'));
    // Metropolis has no Yoruba dot-below letters, tone marks or the naira sign. Anything it cannot draw uses Noto Sans.
    doc.registerFont('NR', path.join(NOTO_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('NB', path.join(NOTO_DIR, 'NotoSans-Bold.ttf'));
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);


    type Weight = 'R' | 'S' | 'B';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metroFont = (w: Weight): any => { doc.font(w); return (doc as any)._font?.font; };
    const supported = (w: Weight, text: string) => {
      const f = metroFont(w);
      if (!f || typeof f.hasGlyphForCodePoint !== 'function') return true;
      for (const ch of text.normalize('NFC')) { const cp = ch.codePointAt(0)!; if (cp > 0x20 && cp !== 0xA0 && !f.hasGlyphForCodePoint(cp)) return false; }
      return true;
    };
    /** Metropolis when it can draw every character, otherwise Noto Sans. */
    const fontFor = (w: Weight, text: string) => (supported(w, text) ? w : w === 'R' ? 'NR' : 'NB');

    const W = doc.page.width - 112;

    doc.font('B').fontSize(20).fillColor(INK).text('Ascentor', { continued: false });
    doc.font('S').fontSize(12).fillColor(GOLD).text('Chat export');
    doc.moveDown(0.6);
    doc.font('R').fontSize(9.5).fillColor(MUTED)
      .text(`Exported by ${meta.exportedBy} on ${stamp(meta.exportedAt)}`)
      .text(meta.from || meta.to ? `Date range: ${meta.from ?? 'start'} to ${meta.to ?? 'now'}` : 'Date range: all messages')
      .text('Confidential. Contains members’ private messages. Handle under the privacy policy.');
    doc.moveDown(0.6);
    doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor(RULE).lineWidth(1).stroke();

    transcripts.forEach((t, ti) => {
      if (ti > 0) doc.addPage();
      doc.moveDown(1);
      doc.font(fontFor('B', t.title)).fontSize(15).fillColor(INK).text(t.title, { width: W });
      const sub = `${t.subtitle} - ${t.lines.length} messages${t.truncated ? ' (truncated: more exist)' : ''}`;
      doc.font(fontFor('R', sub)).fontSize(10).fillColor(MUTED).text(sub, { width: W });
      doc.moveDown(0.6);
      if (!t.lines.length) doc.font('R').fontSize(10.5).fillColor(MUTED).text('No messages in this range.');
      for (const l of t.lines) {
        if (doc.y > doc.page.height - 110) doc.addPage();
        const head = `${l.who}  -  ${stamp(l.at)}`;
        doc.font(fontFor('S', head)).fontSize(9).fillColor(GOLD).text(head, { width: W });
        doc.font(fontFor('R', l.text)).fontSize(10.5).fillColor(INK).text(l.text || ' ', { width: W, lineGap: 1.5 });
        doc.moveDown(0.55);
      }
    });

    // page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('R').fontSize(8.5).fillColor(MUTED).text(`Ascentor - Confidential - Page ${i - range.start + 1} of ${range.count}`, 56, doc.page.height - 40, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}
