// lib/validation/common.ts
// Reusable Zod primitives. Everything is trimmed and length-bounded: an
// unbounded string in a request schema is a bug.
import { z } from 'zod';

/** Required text, trimmed, 1..max characters. */
export const text = (max = 200, label = 'This field') =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} is too long (max ${max} characters).`);

/** Optional text: absent, null or blank becomes undefined. */
export const optionalText = (max = 200) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v ?? undefined),
    z.string().trim().max(max, `Too long (max ${max} characters).`).optional(),
  );

/** Optional text that may be null in the database. */
export const nullableText = (max = 200) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null),
    z.string().trim().max(max, `Too long (max ${max} characters).`).nullable(),
  );

export const email = z
  .string({ error: 'A valid email address is required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Email address is too long.')
  .pipe(z.email('A valid email address is required.'));

export const uuid = z.string({ error: 'A valid id is required.' }).trim().pipe(z.uuid('A valid id is required.'));

/** URL slug: lowercase letters, digits, hyphen. */
export const slug = z
  .string({ error: 'A valid slug is required.' })
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use letters, numbers, hyphens and underscores only.');

/** Phone number in loose international form; real validation happens in the route. */
export const phone = z
  .string({ error: 'A valid phone number is required.' })
  .trim()
  .min(7, 'A valid phone number is required.')
  .max(20, 'A valid phone number is required.')
  .regex(/^\+?[0-9 ()-]+$/, 'A valid phone number is required.');

export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url({ protocol: /^https?$/, error: 'A valid http(s) URL is required.' }));

/** A positive integer coming from JSON or a query string. */
export const posInt = (max = 1_000_000_000) =>
  z.coerce.number().int().positive().max(max);

/** Paystack-style payment reference. */
export const paymentReference = z
  .string({ error: 'A payment reference is required.' })
  .trim()
  .min(6)
  .max(100)
  .regex(/^[A-Za-z0-9_.=-]+$/, 'Invalid payment reference.');

export const planId = z.enum(['explorer', 'builder', 'leader', 'climber']);
export const billingCycle = z.enum(['monthly', 'yearly']);

/** Boolean that also accepts "true"/"false" strings (query strings). */
export const boolish = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export { z };
