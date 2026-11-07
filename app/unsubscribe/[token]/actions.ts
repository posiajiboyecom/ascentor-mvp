'use server';
// Unsubscribe from every Ascentor bulk email, from the link in a campaign email.
import { emailDb } from '@/lib/email/system';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unsubscribe(token: string): Promise<{ ok: boolean }> {
  if (!UUID.test(token)) return { ok: false };
  const { data, error } = await emailDb().rpc('email_unsubscribe', { t: token, src: 'link' });
  return { ok: !error && typeof data === 'string' };
}
