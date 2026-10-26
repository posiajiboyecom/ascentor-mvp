// Lets a registrant open their Summit ticket without any email: the website shows it, from details only they know.
import 'server-only';
import QRCode from 'qrcode';

export interface TicketView {
  name: string;
  attendance: 'onsite' | 'virtual';
  reference: string;
  registrationId: string;
  qrDataUrl: string;
  emailSent: boolean;
}

/** The short code printed on the screen ticket, e.g. ES-1A2B3C4D. Derived from the registration id, so nothing extra is stored. */
export const referenceOf = (id: string) => `ES-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const digits = (v: string) => String(v ?? '').replace(/\D/g, '');

/** Phone numbers are typed many ways (+234 803..., 0803...). Compare the last 9 digits, which is the part that identifies the line. */
export function samePhone(a: string, b: string): boolean {
  const x = digits(a), y = digits(b);
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

/** True when the second factor matches: the WhatsApp number given at registration, or the ES- reference code. Exact match only. */
export function secondFactorMatches(reg: { id: string; whatsapp?: string | null }, factor: { whatsapp?: string; reference?: string }): boolean {
  if (factor.reference && factor.reference.trim().toUpperCase() === referenceOf(reg.id)) return true;
  if (factor.whatsapp && reg.whatsapp && samePhone(factor.whatsapp, reg.whatsapp)) return true;
  return false;
}

export async function ticketView(reg: Record<string, any>): Promise<TicketView> {
  const attendance = reg.attendance_type === 'virtual' ? 'virtual' : 'onsite';
  // The same payload the emailed PDF ticket carries, so the door scanner treats both alike.
  const payload = `ELEV2026|${reg.id}|${attendance}|${reg.payment_reference ?? ''}`;
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#0F0F0E', light: '#FFFFFF' } });
  return { name: String(reg.full_name ?? ''), attendance, reference: referenceOf(reg.id), registrationId: String(reg.id), qrDataUrl, emailSent: !!reg.confirmation_email_sent_at };
}
