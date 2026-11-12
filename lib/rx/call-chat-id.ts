import 'server-only';
import { createHash } from 'crypto';

/** One id per Circle call: the Circle and the day in Lagos. In-call chat is grouped by it (call_chat_messages.call_id). */
export function circleCallId(circleId: string, at = new Date()): string {
  const day = at.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const h = createHash('sha256').update(`circle-call:${circleId}:${day}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
