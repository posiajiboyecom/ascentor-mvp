import 'server-only';
// Elevation Summit referrals. Rules, in one place:
//  - A code is random (never derived from a name or email).
//  - A signup through a link is recorded as 'pending'. It counts ('verified') only after the new person clicks the link in their
//    confirmation email, so a made-up address never earns anyone a point.
//  - Same person signing up for themselves is rejected (same normalised email, same WhatsApp, same device).
//  - Same network as the referrer, a throwaway email domain, a second spelling of an existing email, or more than two signups from
//    one network for the same referrer is held as 'flagged' for an admin. Shared campus networks mean IP alone never rejects.
//  - Raw IP addresses are never stored: only a salted hash.
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/rate-limit';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REF_CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;
export const MAX_PER_NETWORK = 2;

const secret = () => process.env.SUMMIT_REFERRAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
const hmac = (s: string) => crypto.createHmac('sha256', secret()).update(s).digest('hex');

const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'throwawaymail.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com']);

export function generateCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Lowercase; for Gmail also drop dots and +tags, so a.b+1@gmail.com is the same person as ab@gmail.com. */
export function normaliseEmail(raw: string): string {
  const e = raw.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at); let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  local = local.split('+')[0];
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}
export const isDisposable = (email: string) => DISPOSABLE.has(email.slice(email.lastIndexOf('@') + 1).toLowerCase());
export const normalisePhone = (raw: string) => raw.replace(/[^\d]/g, '').replace(/^0+/, '');

export const ipHash = (req: Request) => hmac(`ip:${getClientIp(req)}`);
export const deviceHash = (device: string | null | undefined) => (device && /^[a-zA-Z0-9-]{16,64}$/.test(device) ? hmac(`dev:${device}`) : null);

/** Token in the confirmation email link. Stateless: only the server can make one for a registration id. */
export const verifyToken = (registrationId: string) => hmac(`verify:${registrationId}`).slice(0, 32);
export function tokenOk(registrationId: string, token: string): boolean {
  const want = Buffer.from(verifyToken(registrationId)); const got = Buffer.from(String(token ?? ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://joinascentor.com';
export const referralLink = (code: string) => `${SITE}/elevation-summit?ref=${code}`;
export const verifyLink = (registrationId: string) => `${SITE}/api/summit/verify?r=${registrationId}&t=${verifyToken(registrationId)}`;

/** Too many signups from one network in an hour: a shared, durable limit (the in-memory one resets on every cold start). */
export async function networkBusy(hash: string, limit = 8): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin.from('summit_registrations').select('id', { count: 'exact', head: true }).eq('signup_ip_hash', hash).gte('created_at', since);
  return (count ?? 0) >= limit;
}

/** Record the referral for a new registration. Never throws and never blocks the registration. */
export async function attributeReferral(reg: { id: string; email: string; whatsapp: string; signup_ip_hash: string | null; signup_device_hash: string | null }, ref: string | null | undefined) {
  try {
    const code = String(ref ?? '').trim().toUpperCase();
    if (!REF_CODE_RE.test(code)) return;
    const { data: referrer } = await supabaseAdmin.from('summit_registrations')
      .select('id, email_normalised, whatsapp_normalised, signup_ip_hash, signup_device_hash').eq('referral_code', code).eq('payment_status', 'paid').maybeSingle();
    if (!referrer || referrer.id === reg.id) return;

    const emailN = normaliseEmail(reg.email);
    // A clean signup counts straight away. Only suspicious ones are held for an admin (flagged) or refused (rejected).
    let status: 'verified' | 'flagged' | 'rejected' = 'verified'; let reason: string | null = null;
    const hold = (s: 'flagged' | 'rejected', why: string) => { if (status !== 'rejected') { status = s; reason = reason ? `${reason}; ${why}` : why; } };

    if (referrer.email_normalised && referrer.email_normalised === emailN) hold('rejected', 'same email as the referrer');
    if (referrer.whatsapp_normalised && referrer.whatsapp_normalised === normalisePhone(reg.whatsapp)) hold('rejected', 'same WhatsApp number as the referrer');
    if (referrer.signup_device_hash && reg.signup_device_hash && referrer.signup_device_hash === reg.signup_device_hash) hold('rejected', 'same device as the referrer');
    if (referrer.signup_ip_hash && reg.signup_ip_hash && referrer.signup_ip_hash === reg.signup_ip_hash) hold('flagged', 'same network as the referrer');
    if (isDisposable(emailN)) hold('flagged', 'throwaway email domain');
    const { count: dupes } = await supabaseAdmin.from('summit_registrations').select('id', { count: 'exact', head: true }).eq('email_normalised', emailN).neq('id', reg.id);
    if ((dupes ?? 0) > 0) hold('flagged', 'another registration uses the same email');
    if (reg.signup_ip_hash) {
      const { data: siblings } = await supabaseAdmin.from('summit_referrals').select('referred_id, summit_registrations!summit_referrals_referred_id_fkey(signup_ip_hash)').eq('referrer_id', referrer.id).neq('status', 'rejected');
      const same = (siblings ?? []).filter((s) => ((s as unknown as { summit_registrations: { signup_ip_hash: string | null } | null }).summit_registrations?.signup_ip_hash) === reg.signup_ip_hash).length;
      if (same >= MAX_PER_NETWORK) hold('flagged', `more than ${MAX_PER_NETWORK} signups from one network`);
    }
    const now = new Date().toISOString();
    const { data: row } = await supabaseAdmin.from('summit_referrals')
      .insert({ referrer_id: referrer.id, referred_id: reg.id, status, reason, ...(status === 'verified' ? { verified_at: now } : {}) })
      .select('id').maybeSingle();
    if (row && status === 'verified') await notifyReferrer(referrer.id as string, reg.id);
  } catch (e) { console.error('[summitReferral] attribute failed:', (e as Error).message); }
}

export async function verifiedCount(referrerId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('summit_referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', referrerId).eq('status', 'verified');
  return count ?? 0;
}

/** Email the referrer that a friend just counted for them, with their new total. Never throws. */
export async function notifyReferrer(referrerId: string, friendRegistrationId: string): Promise<void> {
  try {
    const { sendReferralCreditedEmail } = await import('@/lib/summitEmails');
    const [{ data: referrer }, { data: friend }] = await Promise.all([
      supabaseAdmin.from('summit_registrations').select('email, full_name, referral_code').eq('id', referrerId).maybeSingle(),
      supabaseAdmin.from('summit_registrations').select('full_name').eq('id', friendRegistrationId).maybeSingle(),
    ]);
    if (!referrer) return;
    await sendReferralCreditedEmail({ to: referrer.email as string, referrerName: referrer.full_name as string, friendFirstName: String(friend?.full_name ?? '').trim().split(/\s+/)[0] || 'Someone', count: await verifiedCount(referrerId), link: referralLink(String(referrer.referral_code ?? '')) });
  } catch (e) { console.error('[summitReferral] referrer email failed:', (e as Error).message); }
}

/** Older links: a person confirmed their email. Stamps it, and counts any referral still waiting from before instant counting. */
export async function confirmEmail(registrationId: string): Promise<{ ok: boolean; counted: boolean }> {
  const now = new Date().toISOString();
  const { data: reg } = await supabaseAdmin.from('summit_registrations').update({ email_verified_at: now }).eq('id', registrationId).is('email_verified_at', null).select('id, full_name').maybeSingle();
  const { data: ref } = await supabaseAdmin.from('summit_referrals').select('id, referrer_id, status').eq('referred_id', registrationId).maybeSingle();
  if (!ref || ref.status !== 'pending') return { ok: true, counted: false };
  // Only the first confirmation counts (the update above returns nothing on a second click).
  if (!reg) return { ok: true, counted: false };
  const { data: done } = await supabaseAdmin.from('summit_referrals').update({ status: 'verified', verified_at: now }).eq('id', ref.id).eq('status', 'pending').select('id').maybeSingle();
  if (!done) return { ok: true, counted: false };
  await notifyReferrer(ref.referrer_id as string, registrationId);
  return { ok: true, counted: true };
}
