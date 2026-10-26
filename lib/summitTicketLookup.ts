// Lets a registrant open their Summit ticket without any email: the website shows it, from details only they know.
import 'server-only';
import QRCode from 'qrcode';
import { referenceOf } from './summitTicketMatch';

export { referenceOf, samePhone, secondFactorMatches } from './summitTicketMatch';

export interface TicketView {
  name: string;
  attendance: 'onsite' | 'virtual';
  reference: string;
  registrationId: string;
  qrDataUrl: string;
  emailSent: boolean;
}

export async function ticketView(reg: Record<string, any>): Promise<TicketView> {
  const attendance = reg.attendance_type === 'virtual' ? 'virtual' : 'onsite';
  // The same payload the emailed PDF ticket carries, so the door scanner treats both alike.
  const payload = `ELEV2026|${reg.id}|${attendance}|${reg.payment_reference ?? ''}`;
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#0F0F0E', light: '#FFFFFF' } });
  return { name: String(reg.full_name ?? ''), attendance, reference: referenceOf(reg.id), registrationId: String(reg.id), qrDataUrl, emailSent: !!reg.confirmation_email_sent_at };
}
