// lib/validation/schemas/public.ts
// Request schemas for unauthenticated / marketing endpoints: contact, newsletter,
// waitlist, lead magnets, events, summit, surveys.
import { z, text, optionalText, email, uuid } from '../common';
import { summitFormSchema } from '@/app/(marketing)/elevation-summit/summitFormSchema';
import { watchFormSchema } from '@/app/(marketing)/elevation-summit/watch/watchFormSchema';

export const contact = z.strictObject({
  name: text(120, 'Name'),
  email,
  subject: text(200, 'Subject'),
  message: text(4000, 'Message'),
});

export const newsletterSubscribe = z.strictObject({
  email,
  firstName: optionalText(80),
  source: optionalText(60),
});

export const newsletterSend = z.strictObject({
  subject: text(200, 'Subject'),
  content: text(200_000, 'Content'),
});

export const partnerEnquiry = z.strictObject({
  name: text(120, 'Name'),
  email,
  org: text(200, 'Organisation name'),
  message: optionalText(4000),
});

export const waitlist = z.strictObject({
  first_name: text(80, 'First name'),
  last_name: text(80, 'Last name'),
  email,
  whatsapp: optionalText(30),
  life_stage: optionalText(40),
  country: optionalText(60),
  industry: optionalText(80),
  referral_source: optionalText(60),
  utm_source: optionalText(120),
  utm_medium: optionalText(120),
  utm_campaign: optionalText(120),
  referred_by: optionalText(60),
  landing_page: optionalText(300),
  consent: z.boolean().optional(),
});

export const leadMagnet = z.strictObject({
  magnetId: text(60, 'Resource'),
  email,
  firstName: optionalText(80),
  source: optionalText(60),
});

export const eventRegister = z.strictObject({
  eventId: uuid,
  full_name: text(120, 'Full name'),
  email,
  whatsapp: optionalText(30),
  phone: optionalText(30),
  country: optionalText(60),
  city: optionalText(80),
  current_role: optionalText(120),
  organisation: optionalText(160),
  industry: optionalText(80),
  what_building: optionalText(500),
  why_attend: optionalText(1000),
  how_heard: optionalText(120),
  dietary_needs: optionalText(300),
  accessibility: optionalText(300),
});

export const eventNotify = z.strictObject({
  eventId: uuid,
  status: text(40, 'Status'),
  subject: text(200, 'Subject'),
  message: text(5000, 'Message'),
});

/** The public form schema, made strict for the server. */
export const summitRegister = summitFormSchema.strict();
export const summitStreamVerify = watchFormSchema.strict();

export const summitNotify = z.strictObject({
  status: text(40, 'Status'),
  subject: text(200, 'Subject'),
  message: text(5000, 'Message'),
});

export const surveySubmit = z.strictObject({
  answers: z.record(z.string().max(120), z.union([z.string().max(5000), z.number(), z.boolean(), z.array(z.string().max(500)).max(50), z.null()]))
    .refine((r) => Object.keys(r).length > 0 && Object.keys(r).length <= 200, 'Invalid payload'),
  metadata: z.record(z.string().max(120), z.unknown()).optional(),
});

export const checkoutPending = z.strictObject({
  email: email.optional(),
  name: optionalText(120),
  userId: optionalText(64),
});

