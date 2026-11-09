// lib/email/describe.ts
// Pure helpers for the email system (categories, audiences). Safe in the browser: no mailer, no database.

// ── categories ──────────────────────────────────────────────────────────────
/** Where contacts come from. Keys match email_sync_contacts() in the 20261109 migration. */
export const SOURCES: { key: string; label: string; help: string }[] = [
  { key: 'newsletter', label: 'Newsletter subscribers', help: 'Signed up for the newsletter on the website' },
  { key: 'members', label: 'App members', help: 'Ascentor accounts (demo accounts are left out)' },
  { key: 'summit', label: 'Elevation Summit registrants', help: 'Registered for The Elevation Summit' },
  { key: 'summit_interest', label: 'Summit interest list', help: 'Asked to hear about the Summit' },
  { key: 'donors', label: 'Donors', help: 'Gave a donation' },
  { key: 'events', label: 'Public event registrants', help: 'Registered for a public event (each event is also a tag)' },
  { key: 'shop', label: 'Shop customers', help: 'Started or completed a merchandise order' },
  { key: 'shop_leads', label: 'Shop leads', help: 'Left their email in the shop' },
  { key: 'waitlist', label: 'Waitlist', help: 'Joined the app waitlist' },
  { key: 'lead_magnets', label: 'Free resource downloads', help: 'Downloaded a free resource' },
  { key: 'contact_form', label: 'Contact form', help: 'Wrote in through the contact form' },
  { key: 'mentors', label: 'Mentor applicants', help: 'Applied to be a mentor' },
  { key: 'partners', label: 'Partners', help: 'Partner enquiries and partner organisation members' },
  { key: 'careers', label: 'Job applicants', help: 'Applied for a role at Ascentor' },
  { key: 'manual', label: 'Added by hand', help: 'Added one at a time in this console' },
  { key: 'imported', label: 'Imported', help: 'Imported from a CSV file' },
];
export const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));
export const sourceLabel = (k: string) => SOURCE_LABEL[k] ?? k;
export const tagLabel = (t: string) => (t.startsWith('event:') ? t.slice(6) : t);

// ── senders ─────────────────────────────────────────────────────────────────
/** Who a campaign comes from. Addresses are resolved on the server from lib/contact.ts. */
export type SenderKey = 'default' | 'greg' | 'posi' | 'summit';
export const SENDERS: { key: SenderKey; label: string; help: string }[] = [
  { key: 'default', label: 'Ascentor (default)', help: 'The name in Settings, from the main mailbox' },
  { key: 'greg', label: 'Greg from Ascentor', help: 'Marketing and newsletters · greg@joinascentor.com' },
  { key: 'posi', label: 'Posi Ajiboye', help: 'Personal notes from Posi · a.samuel@joinascentor.com' },
  { key: 'summit', label: 'The Elevation Summit', help: 'Summit updates · summit@joinascentor.com' },
];
export const parseSender = (x: unknown): SenderKey => (SENDERS.some((s) => s.key === x) ? (x as SenderKey) : 'default');

/** Personal fields a campaign can use. {{referral_link}} is the recipient's own Summit referral link (the Summit page if they have none). */
export const MERGE_FIELDS = [['{{first_name}}', 'First name'], ['{{name}}', 'Full name'], ['{{email}}', 'Email'], ['{{referral_link}}', 'Summit referral link']] as const;
export const MERGE_KEYS = MERGE_FIELDS.map(([v]) => v.slice(2, -2));

export interface Audience { all: boolean; sources: string[]; tags: string[]; exclude: string[]; emails: string[] }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

export function parseAudience(x: unknown): Audience {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const list = (v: unknown, max = 200) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean).slice(0, max) : []);
  return {
    all: o.all === true,
    sources: list(o.sources).filter((s) => s in SOURCE_LABEL),
    tags: list(o.tags),
    exclude: list(o.exclude).filter((s) => s in SOURCE_LABEL),
    emails: list(o.emails, 2000).map((e) => e.toLowerCase()).filter(isEmail),
  };
}
export const audienceIsEmpty = (a: Audience) => !a.all && !a.sources.length && !a.tags.length && !a.emails.length;

export function describeAudience(a: Audience): string {
  if (a.all) return a.exclude.length ? `All contacts except ${a.exclude.map(sourceLabel).join(', ')}` : 'All contacts';
  const parts = [...a.sources.map(sourceLabel), ...a.tags.map(tagLabel)];
  if (a.emails.length) parts.push(`${a.emails.length} named ${a.emails.length === 1 ? 'address' : 'addresses'}`);
  const base = parts.join(', ') || 'Nobody yet';
  return a.exclude.length ? `${base}, except ${a.exclude.map(sourceLabel).join(', ')}` : base;
}

