// Transactional email fallback (Resend), used only when SMTP cannot send. OFF unless BOTH are set in Vercel:
//   EMAIL_FALLBACK_PROVIDER=resend
//   RESEND_API_KEY=<key>
// Optional: EMAIL_FALLBACK_FROM  (e.g. Ascentor <hello@joinascentor.com>) - must be on a domain verified in Resend.
// With neither set, nothing here runs and sending behaves exactly as before.

type Attachment = { filename: string; content: Buffer; contentType: string; cid?: string };
export type FallbackMessage = { from: string; to: string; subject: string; html: string; text?: string; replyTo?: string; attachments?: Attachment[] };

export function fallbackEnabled(): boolean {
  return (process.env.EMAIL_FALLBACK_PROVIDER || '').toLowerCase() === 'resend' && !!process.env.RESEND_API_KEY;
}

export async function sendViaFallback(m: FallbackMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!fallbackEnabled() || !key) throw new Error('Fallback email provider is not enabled');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FALLBACK_FROM || m.from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      ...(m.text ? { text: m.text } : {}),
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      ...(m.attachments?.length ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64'), ...(a.cid ? { content_id: a.cid } : {}) })) } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // The reply names the problem (unverified domain, bad key). It never echoes the key.
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw Object.assign(new Error(`Fallback provider refused the message (${res.status}) ${detail}`), { code: `FALLBACK_${res.status}` });
  }
}
