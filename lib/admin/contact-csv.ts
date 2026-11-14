// lib/admin/contact-csv.ts
// CSV exports of people's contacts, for importing into a phone or a mail tool.
// WhatsApp numbers come out in +234 form (phones need the country code to match a WhatsApp account),
// in Google Contacts columns with a label, so the file imports straight into a phone's contacts.

/** Normalise a typed phone number to international form. Nigerian local numbers get +234. */
export function toIntlPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const plus = raw.trim().startsWith('+');
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (plus) return `+${d}`;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  if (d.startsWith('234')) return `+${d}`;
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length === 10) return `+234${d}`;
  return `+${d}`;
}

// People type their own names: stop a spreadsheet from running one as a formula.
const safeText = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export interface Person { name: string | null; phone?: string | null; email?: string | null }
export interface ContactCsv { content: string; count: number; duplicates: number; missing: number }

/** One row per WhatsApp number, Google Contacts columns, every contact under `label`.
 *  `nameTag` is added to the end of each name (e.g. "Ada Obi TES2026") so the contacts are easy to find in a phone. */
export function whatsappCsv(people: Person[], label: string, nameTag = ''): ContactCsv {
  const seen = new Set<string>();
  const rows: string[][] = [];
  let missing = 0;
  for (const p of people) {
    const num = toIntlPhone(p.phone);
    if (!num) { missing++; continue; }
    if (seen.has(num)) continue;
    seen.add(num);
    const parts = safeText((p.name || '').trim()).split(/\s+/);
    const last = [parts.slice(1).join(' '), nameTag].filter(Boolean).join(' ');
    rows.push([parts[0] ?? '', last, 'Mobile', num, label]);
  }
  const header = ['First Name', 'Last Name', 'Phone 1 - Label', 'Phone 1 - Value', 'Labels'];
  return { content: toCsv([header, ...rows]), count: rows.length, duplicates: people.length - missing - rows.length, missing };
}

/** One row per email address: Name, Email. */
export function emailCsv(people: Person[]): ContactCsv {
  const seen = new Set<string>();
  const rows: string[][] = [];
  let missing = 0;
  for (const p of people) {
    const email = (p.email || '').trim().toLowerCase();
    if (!email) { missing++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    rows.push([safeText((p.name || '').trim()), safeText(email)]);
  }
  return { content: toCsv([['Name', 'Email'], ...rows]), count: rows.length, duplicates: people.length - missing - rows.length, missing };
}

/** "Exported 359 numbers, 3 duplicates removed, 1 without one skipped." */
export function exportNote(what: string, r: ContactCsv): string {
  return `Exported ${r.count} ${what}${r.count === 1 ? '' : 's'}`
    + (r.duplicates > 0 ? `, ${r.duplicates} duplicate${r.duplicates === 1 ? '' : 's'} removed` : '')
    + (r.missing > 0 ? `, ${r.missing} without one skipped` : '') + '.';
}
