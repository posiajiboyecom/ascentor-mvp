// lib/admin/contact.ts
// Client-safe helpers that turn what a person submitted into links the admin can tap: call, WhatsApp, email.

/** Digits for a phone number in international form (no plus), or null when it does not look like a phone number. Nigerian numbers written 0803... become 234803... */
export function phoneDigits(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let d = s.replace(/[^\d+]/g, '');
  const plus = d.startsWith('+');
  d = d.replace(/\D/g, '');
  if (!plus) {
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0') && d.length === 11) d = `234${d.slice(1)}`;
    else if (d.length === 10 && /^[789]/.test(d)) d = `234${d}`;
  }
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export interface ContactLinks { call: string | null; whatsapp: string | null; email: string | null }

export function contactLinks(c: { name?: string | null; phone?: string | null; email?: string | null }): ContactLinks {
  const d = phoneDigits(c.phone);
  const first = (c.name ?? '').trim().split(/\s+/)[0] || '';
  const hello = `Hello${first ? ` ${first}` : ''}, this is Ascentor about The Elevation Summit.`;
  const email = (c.email ?? '').trim();
  return {
    call: d ? `tel:+${d}` : null,
    whatsapp: d ? `https://wa.me/${d}?text=${encodeURIComponent(hello)}` : null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}?subject=${encodeURIComponent('The Elevation Summit')}` : null,
  };
}
