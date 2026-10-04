// lib/validation/schemas/member.ts
// Request schemas for signed-in member features: coach, community, goals,
// experts, referral, usage, push, subscription.
import { z, text, email, uuid, nullableText } from '../common';

export const DIMENSIONS = ['Mind', 'Vocation', 'Character', 'Relationships', 'Community', 'Legacy'] as const;

export const coachSession = z.strictObject({
  sessionId: z.union([uuid, z.null()]).optional(),
  sessionTypeId: text(60, 'Session type'),
  message: z.string({ error: 'A message is required.' }).trim().min(1, 'A message is required.').max(4000, 'Message is too long (max 4000 characters).'),
});

export const coachingSummary = z.strictObject({ sessionId: uuid });

export const communityCheckin = z.strictObject({
  content: z.string({ error: 'Write a reflection before checking in.' }).trim().min(1, 'Write a reflection before checking in.').max(2000, 'Keep your reflection under 2000 characters.'),
  dimensionTag: z.enum(DIMENSIONS, { error: 'Invalid dimension.' }).nullish(),
});

export const channelSlug = z.strictObject({ slug: text(80, 'Channel') });

export const goalMilestone = z.strictObject({
  goalId: uuid,
  field: z.enum(['milestone_1', 'milestone_2', 'milestone_3']),
  completed: z.boolean(),
});

export const expertSessionRef = z.strictObject({ sessionId: uuid });

export const referralRedeem = z.strictObject({
  referralCode: z.string({ error: 'Referral code required' }).trim().min(3, 'Referral code required').max(32).toUpperCase(),
});

export const usageFeature = z.strictObject({ feature: text(60, 'Feature') });

export const subscriptionCancel = z.strictObject({ reason: nullableText(500).optional() });

export const pushCommunity = z.strictObject({
  targetUserId: uuid,
  title: text(120, 'Title'),
  body: text(300, 'Body'),
  url: z.string().max(512).regex(/^\//, 'url must be a site path').optional(),
});

export const pushSend = z.strictObject({
  userId: uuid,
  title: text(120, 'Title'),
  body: text(300, 'Body'),
  url: z.string().max(512).regex(/^\//, 'url must be a site path').optional(),
  tag: z.string().max(80).optional(),
  icon: z.string().max(512).optional(),
});

export const pushSubscribe = z.strictObject({
  subscription: z.looseObject({
    endpoint: z.url({ protocol: /^https$/, error: 'Invalid subscription endpoint.' }).max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.strictObject({ p256dh: z.string().max(256), auth: z.string().max(128) }).optional(),
  }),
});

export const pushSubscribeNative = z.strictObject({
  token: text(512, 'Device token'),
  platform: z.enum(['ios', 'android', 'web']),
});

export const pushUnsubscribe = z.strictObject({ endpoint: text(2048, 'Endpoint') });

export const sessionReminder = z.strictObject({ sessionId: uuid });

export const intelAnalyse = z.strictObject({
  prompt: z.string().trim().min(1, 'Missing prompt').max(20_000),
  raw_data: z.unknown().optional(),
});

export const userWelcome = z.strictObject({
  email,
  name: z.string().trim().max(80).optional(),
  userId: z.string().max(64),
});
