// lib/validation/schemas/partner.ts
// Request schemas for the white-label partner portal (/api/partner/*).
import { z, text, optionalText, email, uuid, nullableText } from '../common';

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #C8A96E.');
const optionalHex = z.union([hexColor, z.literal('')]).optional();
const optionalAssetUrl = z.union([z.string().trim().max(2048), z.null()]).optional();

export const brandSave = z.strictObject({
  partnerId: uuid,
  brand: z.strictObject({
    platform_name: text(80, 'Platform name'),
    tagline: nullableText(160).optional(),
    logo_url: optionalAssetUrl,
    logo_dark_url: optionalAssetUrl,
    favicon_url: optionalAssetUrl,
    primary_color: optionalHex,
    accent_color: optionalHex,
    text_color: optionalHex,
    bg_color: optionalHex,
    card_color: optionalHex,
    border_color: optionalHex,
    font_heading: z.string().trim().max(60).optional(),
    font_body: z.string().trim().max(60).optional(),
    hide_ascentor_branding: z.boolean().optional(),
  }),
});

export const configPatch = z.strictObject({
  name: text(120, 'Name').optional(),
});

const subdomain = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,30}$/, 'Subdomain must be 3 to 30 lowercase letters, numbers, or hyphens.');

export const settingsPatch = z.strictObject({
  partnerId: uuid.optional(),
  subdomain: subdomain.optional(),
  custom_domain: z.union([z.string().trim().max(253), z.null()]).optional(),
  ai_persona_prompt: z.string().max(8000).optional(),
});

export const domainSave = z.strictObject({
  partnerId: uuid,
  domain: z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9][a-z0-9-_.]+\.[a-z]{2,}$/, 'Invalid domain format'),
});

export const apply = z.strictObject({
  platform_name: text(80, 'Platform name'),
  subdomain: z.string().trim().toLowerCase().min(1, 'Subdomain required').max(40),
  coaching_niche: optionalText(160),
  bio: optionalText(2000),
  agreed_to_terms: z.literal(true, { error: 'You must agree to partner terms' }),
});

const courseFields = {
  title: text(160, 'Title'),
  description: nullableText(2000),
  youtube_id: text(200, 'YouTube video ID or URL'),
  category: nullableText(60),
  difficulty: nullableText(40),
  duration: nullableText(40),
  thumbnail_url: nullableText(2048),
};

export const courseCreate = z.strictObject({
  title: courseFields.title,
  description: courseFields.description.optional(),
  youtube_id: courseFields.youtube_id,
  category: courseFields.category.optional(),
  difficulty: courseFields.difficulty.optional(),
  duration: courseFields.duration.optional(),
  thumbnail_url: courseFields.thumbnail_url.optional(),
});

export const courseUpdate = z.strictObject({
  courseId: uuid,
  title: courseFields.title.optional(),
  description: courseFields.description.optional(),
  youtube_id: courseFields.youtube_id.optional(),
  category: courseFields.category.optional(),
  difficulty: courseFields.difficulty.optional(),
  duration: courseFields.duration.optional(),
  thumbnail_url: courseFields.thumbnail_url.optional(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

export const courseDelete = z.strictObject({ courseId: uuid });

const isoDate = z.string().trim().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date');

export const eventCreate = z.strictObject({
  title: text(160, 'Title'),
  description: nullableText(4000).optional(),
  expert_name: text(120, 'Expert name'),
  expert_bio: nullableText(2000).optional(),
  expert_avatar: nullableText(2048).optional(),
  scheduled_at: isoDate,
  duration_minutes: z.number().int().min(5).max(1440).optional(),
  max_attendees: z.number().int().min(1).max(100_000).nullable().optional(),
  meeting_url: nullableText(2048).optional(),
  topic: nullableText(160).optional(),
});

export const eventUpdate = z.strictObject({
  eventId: uuid,
  title: text(160, 'Title').optional(),
  description: nullableText(4000).optional(),
  expert_name: text(120, 'Expert name').optional(),
  expert_bio: nullableText(2000).optional(),
  expert_avatar: nullableText(2048).optional(),
  scheduled_at: isoDate.optional(),
  duration_minutes: z.number().int().min(5).max(1440).optional(),
  max_attendees: z.number().int().min(1).max(100_000).nullable().optional(),
  meeting_url: nullableText(2048).optional(),
  recording_url: nullableText(2048).optional(),
  topic: nullableText(160).optional(),
  status: z.enum(['scheduled', 'live', 'completed', 'cancelled']).optional(),
});

export const membersInvite = z
  .strictObject({
    role: z.string().trim().min(1).max(30).optional(),
    email: email.optional(),
    emails: z.array(email).min(1).max(50, 'Maximum 50 emails per bulk invite').optional(),
  })
  .refine((v) => v.email || v.emails, { message: 'At least one email is required', path: ['emails'] });

export const memberAction = z.strictObject({
  memberId: uuid,
  action: z.enum(['suspend', 'remove', 'reinstate', 'resend_invite']),
});

export const eventDeleteQuery = z.strictObject({ eventId: uuid });
