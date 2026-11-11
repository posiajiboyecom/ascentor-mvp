// lib/validation/schemas/admin.ts
// Request schemas for /api/admin/*. Authorization (role / permission) is still
// enforced in each route; these schemas make the payloads themselves strict.
import { z, text, optionalText, nullableText, email, uuid, slug } from '../common';

export const NAMESPACES = [
  'framework', 'vocation', 'character', 'mind', 'relationships', 'community',
  'legacy', 'finance', 'leadership', 'career', 'coaching',
] as const;
const namespace = z.enum(NAMESPACES, { error: `Invalid namespace. Valid values: ${NAMESPACES.join(', ')}` });
const tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);

// ── Agents / social ───────────────────────────────────────────────────────────
export const agentTrigger = z.strictObject({
  agentId: text(60, 'agentId'),
  payload: z.record(z.string().max(60), z.unknown()).default({}),
});

export const bufferSend = z.strictObject({
  queueId: text(80, 'queueId'),
  imageUrl: z.string().trim().max(2048).optional(),
});

// ── Moderation ────────────────────────────────────────────────────────────────
export const coachingSessionsDelete = z.strictObject({
  ids: z.array(uuid).min(1, 'ids must be a non-empty array').max(500, 'Cannot delete more than 500 sessions in one request'),
});

export const communityMessagesAction = z.union([
  z.strictObject({ action: z.enum(['delete', 'flag', 'unflag']), id: uuid }),
  z.strictObject({ action: z.literal('delete'), ids: z.array(uuid).min(1).max(500, 'Cannot act on more than 500 messages in one request') }),
]);

// ── AI / knowledge ────────────────────────────────────────────────────────────
export const adminIntelAnalyse = z.strictObject({
  mode: z.enum(['stream', 'json']).default('json'),
  system: z.string().max(20_000).optional(),
  prompt: z.string().trim().min(1, 'prompt is required').max(40_000),
  max_tokens: z.number().int().min(1).max(8000).default(1500),
});

const mentorFields = {
  mentorSlug: text(80, 'mentorSlug'),
  namespace,
  sourceTitle: text(300, 'sourceTitle'),
  tags,
};
export const ingestText = z.strictObject({ text: text(500_000, 'text'), ...mentorFields });
export const ingestUrl = z.strictObject({ url: text(2048, 'url'), ...mentorFields });
export const ingestYoutube = z.strictObject({ videoUrl: text(2048, 'videoUrl'), ...mentorFields });

const batchItem = z.looseObject({
  mentorSlug: text(80, 'mentorSlug'),
  namespace,
  sourceTitle: text(300, 'sourceTitle'),
  url: z.string().trim().max(2048).optional(),
  storagePath: z.string().trim().max(512).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});
export const batchIngest = z.strictObject({
  type: z.enum(['urls', 'pdfs']),
  items: z.array(batchItem).min(1, 'items array is required and must not be empty').max(50, 'Maximum 50 items per batch'),
});

// ── Email / CRM ───────────────────────────────────────────────────────────────
export const mailerlite = z.union([
  z.strictObject({ action: z.enum(['get-groups', 'ensure-groups', 'sync']).default('sync') }),
  z.strictObject({
    action: z.literal('sync-user'),
    email,
    firstName: optionalText(80),
    groups: z.array(z.string().max(40)).max(20).optional(),
  }),
]);

// ── Marketing CMS ─────────────────────────────────────────────────────────────
const draft = z.unknown().refine((v) => v !== undefined, 'draftData required');
export const marketingCms = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('save_section_draft'), sectionId: text(80), draftData: draft }),
  z.strictObject({ action: z.literal('publish_section'), sectionId: text(80) }),
  z.strictObject({ action: z.literal('unpublish_section'), sectionId: text(80) }),
  z.strictObject({ action: z.literal('save_item_draft'), itemId: text(80), draftData: draft }),
  z.strictObject({ action: z.literal('create_item'), sectionId: text(80), draftData: draft }),
  z.strictObject({ action: z.literal('delete_item'), itemId: text(80) }),
  z.strictObject({ action: z.literal('reorder_items'), itemIds: z.array(text(80)).min(1).max(500) }),
  z.strictObject({ action: z.literal('create_section'), pageId: text(80), sectionKey: slug, label: text(120), sectionType: text(60) }),
]);

// ── Partners ──────────────────────────────────────────────────────────────────
export const partnerAdminAction = z.strictObject({
  partnerId: uuid,
  action: z.enum(['approve', 'suspend', 'reject', 'reinstate']),
});

// ── Payments ──────────────────────────────────────────────────────────────────
const reference = text(200, 'reference');
export const paymentsAction = z.strictObject({
  action: z.enum(['verify', 'resend']),
  reference,
});
export const paymentsDelete = z.union([
  z.strictObject({ kind: z.literal('attempt'), reference }),
  z.strictObject({ kind: z.literal('attempts'), references: z.array(reference).min(1).max(500) }),
  z.strictObject({ kind: z.literal('summit_registration'), id: uuid }),
  z.strictObject({ kind: z.literal('payment'), id: uuid }),
]);

// ── Users / permissions ───────────────────────────────────────────────────────
export const permissionsAction = z.strictObject({
  targetUserId: uuid,
  action: z.enum(['grant', 'revoke', 'set_permissions']),
  value: z.array(z.string().max(80)).max(100).optional(),
});

export const userAdminAction = z.discriminatedUnion('action', [
  z.strictObject({ targetUserId: uuid, action: z.literal('change_role'), value: z.enum(['member', 'moderator', 'admin']) }),
  z.strictObject({ targetUserId: uuid, action: z.literal('ban'), value: z.string().trim().max(500).optional() }),
  z.strictObject({ targetUserId: uuid, action: z.literal('unban') }),
  z.strictObject({ targetUserId: uuid, action: z.literal('change_plan'), value: z.enum(['free', 'explorer', 'builder', 'pinnacle', 'leader']) }),
  z.strictObject({ targetUserId: uuid, action: z.literal('delete') }),
]);

export const findUser = z.strictObject({ email });

// ── Summit ────────────────────────────────────────────────────────────────────
export const summitRegistrationAction = z.union([
  z.strictObject({ action: z.enum(['remind_all', 'referral_invite_all']) }),
  z.strictObject({ action: z.enum(['resend', 'remind', 'comp', 'referral_invite']), id: uuid }),
]);
export const summitRegistrationPatch = z.strictObject({
  id: uuid,
  ticket_type: nullableText(60).optional(),
  notes: nullableText(5000).optional(),
});
export const summitDonationAction = z.strictObject({ id: uuid, action: z.literal('resend') });
export const summitStream = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('save'), enabled: z.boolean(), videoId: z.string().trim().max(200).optional() }),
  z.strictObject({ action: z.literal('send_all') }),
  z.strictObject({ action: z.literal('send_one'), id: uuid }),
  z.strictObject({ action: z.literal('send_custom'), email, fullName: optionalText(120) }),
  z.strictObject({ action: z.literal('send_event_day'), force: z.boolean().optional() }),
]);

// ── Content ───────────────────────────────────────────────────────────────────
export const personalBrandGenerate = z.strictObject({
  pillar: text(60).default('authority'),
  platform: z.enum(['linkedin', 'x', 'both', 'twitter']).default('both'),
  topic: z.string().trim().max(500).default(''),
  intent: text(60).default('authority'),
});
export const personalBrandImage = z.strictObject({
  postContent: z.string().max(5000).default(''),
  style: z.string().trim().max(60).default('dark_gold'),
  platform: z.string().trim().max(30).default('linkedin'),
  customPrompt: z.string().max(2000).default(''),
});

const surveyQuestion = z.looseObject({ id: z.union([z.string().max(80), z.number()]).optional(), type: z.string().max(40).optional(), label: z.string().max(500).optional() });
export const surveyCreate = z.strictObject({
  title: text(200, 'Title'),
  description: nullableText(2000).optional(),
  slug,
  questions: z.array(surveyQuestion).min(1, 'Missing required fields').max(200),
});
export const surveyUpdate = z.strictObject({
  title: text(200).optional(),
  description: nullableText(2000).optional(),
  slug: slug.optional(),
  questions: z.array(surveyQuestion).max(200).optional(),
  is_published: z.boolean().optional(),
});

export const listQuery = z.object({
  search: z.string().trim().max(120).default(''),
  role: z.string().trim().max(20).default(''),
  status: z.string().trim().max(20).default(''),
  page: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/** POST /api/admin/payments: a per-attempt action, or an empty body meaning "reconcile now". */
export const paymentsPost = z.union([paymentsAction, z.strictObject({})]);

// ── Shop ──────────────────────────────────────────────────────────────────────
const shopStr = (max: number) => z.string().trim().max(max).nullable();
const shopFields = {
  tagline: shopStr(200),
  description: shopStr(5000),
  image_url: shopStr(2048),
  hover_image_url: shopStr(2048),
  gallery_urls: z.array(z.string().trim().url().max(2048)).max(6).nullable(),
  badge: shopStr(40),
  shop_category: z.enum(['Apparel', 'Accessories', 'Books and journals', 'Digital', 'Courses']),
  fulfilment: z.enum(['ship', 'digital', 'learn']),
  price_ngn: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  sizes: z.array(z.string().trim().min(1).max(10)).max(12).nullable(),
  file_path: shopStr(300),
  lead_capture: z.boolean(),
  published: z.boolean(),
  is_featured: z.boolean(),
  sort_order: z.number().int().min(0).max(100_000),
  min_plan: z.enum(['seeker', 'builder']).nullable(),
};
export const shopProductCreate = z.strictObject({
  name: text(160, 'Name'),
  shop_category: shopFields.shop_category,
  fulfilment: shopFields.fulfilment,
  price_ngn: shopFields.price_ngn,
  tagline: shopFields.tagline.optional(),
  description: shopFields.description.optional(),
  image_url: shopFields.image_url.optional(),
  hover_image_url: shopFields.hover_image_url.optional(),
  gallery_urls: shopFields.gallery_urls.optional(),
  badge: shopFields.badge.optional(),
  stock: shopFields.stock.optional(),
  sizes: shopFields.sizes.optional(),
  file_path: shopFields.file_path.optional(),
  lead_capture: shopFields.lead_capture.optional(),
  published: shopFields.published.optional(),
  is_featured: shopFields.is_featured.optional(),
  sort_order: shopFields.sort_order.optional(),
  min_plan: shopFields.min_plan.optional(),
});
export const shopProductUpdate = z.strictObject({
  id: uuid,
  name: text(160, 'Name').optional(),
  shop_category: shopFields.shop_category.optional(),
  fulfilment: shopFields.fulfilment.optional(),
  price_ngn: shopFields.price_ngn.optional(),
  tagline: shopFields.tagline.optional(),
  description: shopFields.description.optional(),
  image_url: shopFields.image_url.optional(),
  hover_image_url: shopFields.hover_image_url.optional(),
  gallery_urls: shopFields.gallery_urls.optional(),
  badge: shopFields.badge.optional(),
  stock: shopFields.stock.optional(),
  sizes: shopFields.sizes.optional(),
  file_path: shopFields.file_path.optional(),
  lead_capture: shopFields.lead_capture.optional(),
  published: shopFields.published.optional(),
  is_featured: shopFields.is_featured.optional(),
  sort_order: shopFields.sort_order.optional(),
  min_plan: shopFields.min_plan.optional(),
});
export const shopProductDelete = z.strictObject({ id: uuid });
export const shopOrderUpdate = z.strictObject({
  id: uuid,
  status: z.enum(['pending', 'paid', 'packing', 'shipped', 'delivered', 'ready', 'cancelled']),
});
