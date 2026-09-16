// ---------------------------------------------------------------------------
// Elevation Summit 2026 – branded A5 portrait ticket (PDFKit + QRCode)
// Generates a PDF buffer in memory; nothing is written to disk.
// ---------------------------------------------------------------------------

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

// ── Design tokens ────────────────────────────────────────────────────────────
const GOLD       = '#C8A96E';
const BLACK      = '#0F0F0E';
const WHITE      = '#FAFAF8';
const GRAY       = '#6B7280';
const MUTED_GRAY = '#9CA3AF';
const LIGHT_BG   = '#F4F3EF';
const DIVIDER    = '#E8E6E1';

// A5 portrait in points
const PAGE_W = 419.53;
const PAGE_H = 595.28;

// ── Font helper ───────────────────────────────────────────────────────────────
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts', 'metropolis');
const FONTS: Record<string, string> = {
  'Regular'   : 'Metropolis-Regular.otf',
  'Light'     : 'Metropolis-Light.otf',
  'SemiBold'  : 'Metropolis-SemiBold.otf',
  'Bold'      : 'Metropolis-Bold.otf',
  'ExtraBold' : 'Metropolis-ExtraBold.otf',
};

function fp(weight: keyof typeof FONTS) {
  return path.join(FONT_DIR, FONTS[weight]);
}

// ── Ticket data contract ──────────────────────────────────────────────────────
export interface TicketData {
  fullName:       string;
  email:          string;
  whatsapp:       string;
  organisation?:  string;
  attendanceType: 'onsite' | 'virtual';
  amountPaid:     number;
  currency:       string;
  registrationId: string;
  reference?:     string;
  paidAt?:        string;
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateSummitTicket(data: TicketData): Promise<Buffer> {
  // QR code encodes: tag|regId|type|ref
  const qrPayload = `ELEV2026|${data.registrationId}|${data.attendanceType}|${data.reference ?? ''}`;
  const qrBuffer  = await (QRCode as any).toBuffer(qrPayload, {
    width: 130, margin: 1,
    color: { dark: '#0F0F0E', light: '#FFFFFF' },
  }) as Buffer;

  // Load logo from public folder (server-side path)
  const logoPath   = path.join(process.cwd(), 'public', 'images', 'ascentor-logo-email.png');
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

  // Create PDFKit document – A5 portrait, zero margins (we handle padding manually)
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    info: { Title: 'The Elevation Summit 2026 – Admission Ticket', Author: 'Ascentor' },
  });

  // Register all font weights
  for (const [alias, file] of Object.entries(FONTS)) {
    doc.registerFont(`Metro-${alias}`, path.join(FONT_DIR, file));
  }

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const W  = PAGE_W;
    const H  = PAGE_H;
    const PAD = 28;

    // ── HEADER (black) ────────────────────────────────────────────────────
    const HEADER_H = 160;
    doc.rect(0, 0, W, HEADER_H).fill(BLACK);

    // Logo
    if (logoBuffer) {
      const logoW = 136;
      doc.image(logoBuffer, (W - logoW) / 2, 20, { width: logoW });
    }

    // Thin gold rule below logo
    doc.rect(PAD, 68, W - PAD * 2, 0.75).fill(GOLD);

    // Event name
    doc
      .font('Metro-ExtraBold').fontSize(13.5).fillColor(GOLD)
      .text('The Elevation Summit 2.0', PAD, 78, { width: W - PAD * 2, align: 'center', characterSpacing: 0.4 });

    // Theme subtitle
    doc
      .font('Metro-Regular').fontSize(9).fillColor(WHITE)
      .text('The Rise We Choose', PAD, 98, { width: W - PAD * 2, align: 'center' });

    // Date line
    doc
      .font('Metro-SemiBold').fontSize(7).fillColor(GOLD)
      .text('THURSDAY 19 NOVEMBER 2026  -  10:00AM WAT  -  ADEREMI MAKANJUOLA HALL, LAGOS', PAD, 114, {
        width: W - PAD * 2, align: 'center', characterSpacing: 0.5,
      });

    // Attendance badge pill
    const isVirtual  = data.attendanceType === 'virtual';
    const badgeLabel = isVirtual ? '  VIRTUAL  ' : '  ONSITE  ';
    const badgeBg    = GOLD;
    const badgeTxt   = BLACK;
    const badgeW     = 64;
    const badgeX     = (W - badgeW) / 2;
    const badgeY     = 130;

    doc.roundedRect(badgeX, badgeY, badgeW, 17, 8).fill(badgeBg);
    doc.font('Metro-Bold').fontSize(6.5).fillColor(badgeTxt)
      .text(badgeLabel, badgeX, badgeY + 5, { width: badgeW, align: 'center', characterSpacing: 1 });

    // ── GOLD HEADER BAR ────────────────────────────────────────────────────
    doc.rect(0, HEADER_H, W, 4).fill(GOLD);

    // ── BODY ──────────────────────────────────────────────────────────────
    const FOOTER_H = 130;
    const BODY_Y   = HEADER_H + 4;
    const FOOTER_Y = H - FOOTER_H;
    const BODY_H   = FOOTER_Y - BODY_Y;

    doc.rect(0, BODY_Y, W, BODY_H).fill(WHITE);

    // Attendee label
    doc
      .font('Metro-Bold').fontSize(6.5).fillColor(GOLD)
      .text('ATTENDEE', PAD, BODY_Y + 16, { characterSpacing: 1.5 });

    // Full name
    const nameY = BODY_Y + 29;
    doc
      .font('Metro-ExtraBold').fontSize(15.5).fillColor(BLACK)
      .text(data.fullName, PAD, nameY, { width: W - PAD * 2 - 140, lineBreak: false });

    // Contact info
    const contactX = PAD;
    doc.font('Metro-Regular').fontSize(8.5).fillColor(GRAY);
    doc.text(data.email,    contactX, nameY + 22, { lineBreak: false });
    doc.text(data.whatsapp, contactX, nameY + 35, { lineBreak: false });
    if (data.organisation) {
      doc.text(data.organisation, contactX, nameY + 48, { lineBreak: false });
    }

    // Divider
    const divY = nameY + 66;
    doc.rect(PAD, divY, W - PAD * 2, 0.75).fill(DIVIDER);

    // Ticket details label
    const detailsLabelY = divY + 12;
    doc
      .font('Metro-Bold').fontSize(6.5).fillColor(GOLD)
      .text('TICKET DETAILS', PAD, detailsLabelY, { characterSpacing: 1.5 });

    // QR code (right side, vertically centered in body detail area)
    const QR_SIZE = 112;
    const QR_X    = W - PAD - QR_SIZE;
    const QR_Y    = BODY_Y + 16;

    // QR frame
    doc.rect(QR_X - 5, QR_Y - 5, QR_SIZE + 10, QR_SIZE + 10).fill(LIGHT_BG);
    doc.image(qrBuffer, QR_X, QR_Y, { width: QR_SIZE, height: QR_SIZE });

    // "Scan to verify" label
    doc.font('Metro-Light').fontSize(6).fillColor(MUTED_GRAY)
      .text('Scan to verify', QR_X, QR_Y + QR_SIZE + 6, { width: QR_SIZE, align: 'center' });

    // Detail rows
    const LABEL_X  = PAD;
    const LABEL_W  = 64;
    const VALUE_X  = LABEL_X + LABEL_W + 6;
    const VALUE_W  = QR_X - VALUE_X - 8;
    const ROW_H    = 17;
    let   rowY     = detailsLabelY + 13;

    const rows: [string, string][] = [
      ['Attendance', isVirtual ? 'Virtual Access' : 'Onsite, Lagos'],
      ['Date',       'Thursday, 19 November 2026'],
      ['Time',       '10:00AM WAT'],
      ['Venue',      isVirtual ? 'Online (Zoom)' : 'Aderemi Makanjuola Hall, LASU'],
      ['Amount Paid', formatAmount(data.amountPaid, data.currency)],
    ];

    for (const [label, value] of rows) {
      doc.font('Metro-SemiBold').fontSize(7.5).fillColor(MUTED_GRAY)
        .text(label, LABEL_X, rowY, { width: LABEL_W, lineBreak: false });
      doc.font('Metro-Bold').fontSize(7.5).fillColor(BLACK)
        .text(value, VALUE_X, rowY, { width: VALUE_W, lineBreak: false });
      rowY += ROW_H;
    }

    // ── GOLD FOOTER BAR ────────────────────────────────────────────────────
    doc.rect(0, FOOTER_Y - 4, W, 4).fill(GOLD);

    // ── FOOTER ────────────────────────────────────────────────────────────
    doc.rect(0, FOOTER_Y, W, FOOTER_H).fill(LIGHT_BG);

    // "Valid" stamp
    doc
      .font('Metro-ExtraBold').fontSize(8).fillColor(BLACK)
      .text('VALID FOR ADMISSION  -  THE ELEVATION SUMMIT 2026', PAD, FOOTER_Y + 15, {
        width: W - PAD * 2, align: 'center', characterSpacing: 0.4,
      });

    // Divider above socials
    doc.rect(PAD, FOOTER_Y + 34, W - PAD * 2, 0.5).fill(DIVIDER);

    // Socials
    doc
      .font('Metro-Regular').fontSize(6.5).fillColor(GRAY)
      .text('X: @joinascentor  -  instagram.com/joinascentor  -  ascentorbi.com', PAD, FOOTER_Y + 44, {
        width: W - PAD * 2, align: 'center',
      });

    // Divider above reference
    doc.rect(PAD, FOOTER_Y + 62, W - PAD * 2, 0.5).fill(DIVIDER);

    // Ticket reference
    doc
      .font('Metro-Light').fontSize(6).fillColor(MUTED_GRAY)
      .text(`Ref: ${data.registrationId}`, PAD, FOOTER_Y + 72, { width: W - PAD * 2, align: 'center' });
    if (data.reference) {
      doc
        .font('Metro-Light').fontSize(6).fillColor(MUTED_GRAY)
        .text(`Payment ref: ${data.reference}`, PAD, FOOTER_Y + 82, { width: W - PAD * 2, align: 'center' });
    }

    // Purchase timestamp
    const purchaseLine = `Purchased on ${formatPurchaseDate(data.paidAt ?? new Date().toISOString())}`;
    doc
      .font('Metro-Light').fontSize(6).fillColor(MUTED_GRAY)
      .text(purchaseLine, PAD, FOOTER_Y + 96, { width: W - PAD * 2, align: 'center' });

    doc.end();
  });

  return Buffer.concat(chunks);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(amount: number, currency: string): string {
  if (!amount) return 'N/A';
  const symbol = (currency ?? '').toUpperCase() === 'NGN' ? 'NGN ' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-NG')}`;
}

function daySuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1:  return 'st';
    case 2:  return 'nd';
    case 3:  return 'rd';
    default: return 'th';
  }
}

function formatPurchaseDate(iso: string): string {
  const d = new Date(iso);
  const lagos = new Date(d.getTime() + 60 * 60 * 1000); // WAT = UTC+1
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const day = lagos.getUTCDate();
  const weekday = days[lagos.getUTCDay()];
  const month = months[lagos.getUTCMonth()];
  const year = lagos.getUTCFullYear();

  let h = lagos.getUTCHours();
  const m = String(lagos.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  const hour = String(h).padStart(2, '0');

  return `${weekday} ${day}${daySuffix(day)} ${month} ${year}, ${hour}:${m}${ampm}.`;
}
