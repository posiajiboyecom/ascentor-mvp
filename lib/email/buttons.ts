// lib/email/buttons.ts
// Ready-made email buttons for the campaign editor: WhatsApp, Instagram, Facebook, X, LinkedIn, YouTube, website,
// email, phone, or a plain link. Pure helpers, safe in the browser: no mailer, no database.
//
// Each button is a one-cell table holding a link, which renders the same in Gmail, Outlook and Apple Mail. The icon is
// a white PNG hosted on our site (public/images/email/btn), because inboxes strip inline SVG. Everything here only
// uses tags and attributes that cleanBody() in lib/email/system.ts keeps.

export type ButtonKind = 'whatsapp' | 'instagram' | 'facebook' | 'x' | 'linkedin' | 'youtube' | 'website' | 'email' | 'phone' | 'link';

export interface ButtonPreset {
  kind: ButtonKind;
  label: string;
  /** Platform colour, darkened where needed so white text stays readable (4.5:1 or better). */
  color: string;
  /** File under public/images/email/btn, or null for no icon. */
  icon: string | null;
  defaultText: string;
  /** What the person types: shown as the field label and placeholder. */
  field: string;
  placeholder: string;
}

export const RUST = '#B6502A';
export const INK = '#15181D';

export const BUTTONS: ButtonPreset[] = [
  { kind: 'whatsapp', label: 'WhatsApp', color: '#128C7E', icon: 'whatsapp.png', defaultText: 'Message me on WhatsApp', field: 'WhatsApp number', placeholder: '+234 903 739 2168' },
  { kind: 'instagram', label: 'Instagram', color: '#C13584', icon: 'instagram.png', defaultText: 'Follow on Instagram', field: 'Instagram handle or link', placeholder: '@theelevationsummit' },
  { kind: 'facebook', label: 'Facebook', color: '#1660CC', icon: 'facebook.png', defaultText: 'Find us on Facebook', field: 'Facebook page name or link', placeholder: 'joinascentor' },
  { kind: 'x', label: 'X (Twitter)', color: '#000000', icon: 'x.png', defaultText: 'Follow on X', field: 'X handle or link', placeholder: '@elevatnsummit' },
  { kind: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: 'linkedin.png', defaultText: 'Connect on LinkedIn', field: 'LinkedIn link', placeholder: 'https://linkedin.com/company/joinascentor' },
  { kind: 'youtube', label: 'YouTube', color: '#CC0000', icon: 'youtube.png', defaultText: 'Watch on YouTube', field: 'YouTube channel or video link', placeholder: '@joinascentor or https://youtu.be/…' },
  { kind: 'website', label: 'Website', color: RUST, icon: 'globe.png', defaultText: 'Visit the website', field: 'Web address', placeholder: 'joinascentor.com or {{referral_link}}' },
  { kind: 'email', label: 'Email', color: RUST, icon: 'mail.png', defaultText: 'Email us', field: 'Email address', placeholder: 'joinascentor@gmail.com' },
  { kind: 'phone', label: 'Phone call', color: RUST, icon: 'phone.png', defaultText: 'Call us', field: 'Phone number', placeholder: '+234 903 739 2168' },
  { kind: 'link', label: 'Plain button', color: RUST, icon: null, defaultText: 'Register now', field: 'Link', placeholder: 'https://…' },
];

export const buttonPreset = (k: ButtonKind) => BUTTONS.find((b) => b.kind === k) ?? BUTTONS[BUTTONS.length - 1];

const REFERRAL = /^\{\{\s*referral_link\s*\}\}$/i;
const isUrl = (s: string) => /^https?:\/\//i.test(s);
const handleOf = (s: string) => s.trim().replace(/^@+/, '').replace(/\/+$/, '');
const pathOk = (s: string) => /^[A-Za-z0-9._~\-/@%]+$/.test(s);

/**
 * A phone number as international digits. Nigerian local numbers (0803…, 11 digits) become 234803…; a number with
 * + or 00 keeps its country code. Returns '' when it can't be a phone number.
 */
export function phoneDigits(raw: string): string {
  const s = raw.trim();
  let d = s.replace(/[^\d]/g, '');
  if (!d) return '';
  if (s.startsWith('00')) d = d.slice(2);
  else if (!s.startsWith('+') && d.length === 11 && d.startsWith('0')) d = `234${d.slice(1)}`;
  return d.length >= 8 && d.length <= 15 ? d : '';
}

/**
 * The link a button opens, from what the person typed. Full https links are kept as they are (for any kind).
 * Returns null when the input can't make a safe link, so the editor can say so instead of inserting a broken button.
 */
export function buttonHref(kind: ButtonKind, raw: string, opts: { message?: string } = {}): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  switch (kind) {
    case 'whatsapp': {
      if (isUrl(v)) return /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(v) ? v : null;
      const d = phoneDigits(v);
      if (!d) return null;
      const msg = (opts.message ?? '').trim();
      return `https://wa.me/${d}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    }
    case 'instagram': case 'facebook': case 'x': case 'youtube': {
      if (isUrl(v)) return v;
      const h = handleOf(v);
      if (!h || !pathOk(h)) return null;
      if (kind === 'instagram') return `https://instagram.com/${h}`;
      if (kind === 'facebook') return `https://facebook.com/${h}`;
      if (kind === 'x') return `https://x.com/${h}`;
      return `https://youtube.com/@${h}`;
    }
    case 'linkedin': {
      if (isUrl(v)) return v;
      const h = v.replace(/^(www\.)?linkedin\.com\//i, '').replace(/^\/+/, '');
      return /^(in|company|school)\/[A-Za-z0-9._~\-%]+\/?$/i.test(h) ? `https://linkedin.com/${h}` : null;
    }
    case 'email': {
      const e = v.replace(/^mailto:/i, '');
      return /^[^@\s"<>]+@[^@\s"<>]+\.[^@\s"<>]+$/.test(e) ? `mailto:${e}` : null;
    }
    case 'phone': {
      const d = phoneDigits(v.replace(/^tel:/i, ''));
      return d ? `tel:+${d}` : null;
    }
    case 'website': case 'link': {
      if (REFERRAL.test(v)) return '{{referral_link}}';
      if (isUrl(v)) return v;
      if (/^mailto:/i.test(v)) return v;
      return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v) ? `https://${v}` : null;
    }
  }
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The button's email HTML. `siteUrl` is where the icons are hosted (https, no trailing slash). */
export function buttonHtml(p: { kind: ButtonKind; href: string; text: string; color?: string; align?: 'left' | 'center' }, siteUrl: string): string {
  const preset = buttonPreset(p.kind);
  const color = /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color! : preset.color;
  const text = escText((p.text || preset.defaultText).trim());
  const icon = preset.icon
    ? `<img src="${escAttr(`${siteUrl.replace(/\/$/, '')}/images/email/btn/${preset.icon}`)}" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;border:0;vertical-align:middle;margin:0 8px 0 0;" />`
    : '';
  const align = p.align === 'center' ? 'center' : 'left';
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="${align}" style="margin:8px ${align === 'center' ? 'auto' : '0'} 18px;"><tr><td style="background:${color};border-radius:8px;"><a href="${escAttr(p.href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;">${icon}<span style="vertical-align:middle;color:#ffffff;">${text}</span></a></td></tr></table>`;
}
