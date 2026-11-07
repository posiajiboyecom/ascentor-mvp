// /unsubscribe/<token>: linked from the footer of every campaign email. Asks before acting, because some mail
// scanners open links automatically; mail apps' one-click unsubscribe goes to /api/email/unsubscribe instead.
import { emailDb } from '@/lib/email/system';
import UnsubscribeForm from './UnsubscribeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe · Ascentor', robots: { index: false, follow: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** a•••@gmail.com: enough for someone to recognise their address, without showing it to anyone holding the link. */
const mask = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 1)}•••@${d}`; };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = token === 'preview';
  let email: string | null = null;
  let already = false;
  if (UUID.test(token)) {
    const { data: send } = await emailDb().from('email_sends').select('email').eq('token', token).maybeSingle();
    email = (send?.email as string | undefined) ?? null;
    if (email) {
      const { data: c } = await emailDb().from('email_contacts').select('unsubscribed_at').eq('email', email).maybeSingle();
      already = !!c?.unsubscribed_at;
    }
  }
  const valid = preview || !!email;

  return (
    <main style={{ minHeight: '100vh', background: '#F6F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', border: '1px solid #E8E1D6', borderRadius: 16, padding: '2rem' }}>
        <div style={{ width: 40, height: 4, background: '#B6502A', borderRadius: 2, marginBottom: '1.25rem' }} />
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem', color: '#0F0F0E' }}>Unsubscribe from Ascentor emails</h1>
        {!valid && <p style={{ color: '#4B5563', lineHeight: 1.7 }}>This unsubscribe link isn’t valid any more. Reply “unsubscribe” to any Ascentor email and we’ll take you off the list.</p>}
        {valid && already && <p style={{ color: '#4B5563', lineHeight: 1.7 }}>{email ? mask(email) : 'This address'} is already unsubscribed. You won’t get newsletters or announcements from us.</p>}
        {valid && !already && (
          <>
            <p style={{ color: '#4B5563', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
              Stop newsletters and announcements to <strong>{email ? mask(email) : 'your address'}</strong>? You’ll still get messages you need about anything you sign up for, such as tickets and password resets.
            </p>
            <UnsubscribeForm token={token} preview={preview} />
          </>
        )}
      </div>
    </main>
  );
}
