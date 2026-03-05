// ═══════════════════════════════════════════════════════════
// lib/mailerlite.ts  —  Ascentor × MailerLite integration
// ═══════════════════════════════════════════════════════════
// Handles all subscriber management and automation triggers.
// MailerLite docs: https://developers.mailerlite.com/docs
// ═══════════════════════════════════════════════════════════

const ML_BASE = 'https://connect.mailerlite.com/api';

// ── Group IDs — create these in MailerLite dashboard ───────
// Dashboard → Subscribers → Groups → Create group
// Then paste the IDs here
export const ML_GROUPS = {
  WAITLIST:       process.env.MAILERLITE_GROUP_WAITLIST       || '',  // "Waitlist"
  APP_USERS:      process.env.MAILERLITE_GROUP_APP_USERS      || '',  // "App Users"
  FREE_USERS:     process.env.MAILERLITE_GROUP_FREE_USERS     || '',  // "Free Users"
  PAID_USERS:     process.env.MAILERLITE_GROUP_PAID_USERS     || '',  // "Paid Users"
  NEWSLETTER:     process.env.MAILERLITE_GROUP_NEWSLETTER     || '',  // "Newsletter"
};

// ── Automation IDs — create these in MailerLite dashboard ──
// Dashboard → Automation → Create automation → copy the ID from the URL
export const ML_AUTOMATIONS = {
  WELCOME_SEQUENCE:  process.env.MAILERLITE_AUTOMATION_WELCOME  || '',  // 14-email nurture
  WAITLIST_SEQUENCE: process.env.MAILERLITE_AUTOMATION_WAITLIST || '',  // Waitlist nurture
};

// ── Core fetch wrapper ──────────────────────────────────────
async function mlFetch(
  path: string,
  options: { method?: string; body?: object } = {}
) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) throw new Error('MAILERLITE_API_KEY is not set');

  const res = await fetch(`${ML_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  // 204 No Content — success with no body
  if (res.status === 204) return null;

  const json = await res.json();

  if (!res.ok) {
    console.error(`[MailerLite] ${options.method || 'GET'} ${path} → ${res.status}`, json);
    throw new Error(json?.message || `MailerLite error ${res.status}`);
  }

  return json;
}

// ═══════════════════════════════════════════════════════════
// addOrUpdateSubscriber
// Creates a subscriber or updates if they already exist.
// Assigns to one or more groups.
// ═══════════════════════════════════════════════════════════
export async function addOrUpdateSubscriber(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  fields?: Record<string, string | number | boolean>;
  groups?: string[];   // array of ML_GROUPS values
  resubscribe?: boolean;
}) {
  const { email, firstName, lastName, fields = {}, groups = [], resubscribe = true } = params;

  const body: Record<string, any> = {
    email: email.trim().toLowerCase(),
    fields: {
      name: firstName || '',
      last_name: lastName || '',
      ...fields,
    },
    resubscribe,
    status: 'active',
  };

  // Only include groups array if groups are provided & non-empty
  const validGroups = groups.filter(Boolean);
  if (validGroups.length > 0) {
    body.groups = validGroups;
  }

  const data = await mlFetch('/subscribers', { method: 'POST', body });
  console.log(`[MailerLite] Subscriber upserted: ${email}`);
  return data?.data;
}

// ═══════════════════════════════════════════════════════════
// addSubscriberToGroup
// Adds an existing subscriber to a group by group ID.
// ═══════════════════════════════════════════════════════════
export async function addSubscriberToGroup(subscriberId: string, groupId: string) {
  if (!groupId) {
    console.warn('[MailerLite] addSubscriberToGroup: groupId is empty, skipping');
    return null;
  }
  const data = await mlFetch(`/subscribers/${subscriberId}/groups/${groupId}`, {
    method: 'POST',
  });
  return data;
}

// ═══════════════════════════════════════════════════════════
// triggerAutomation
// Enrols a subscriber into a MailerLite automation by ID.
// The automation handles the full email sequence (all 14 emails).
// ═══════════════════════════════════════════════════════════
export async function triggerAutomation(email: string, automationId: string) {
  if (!automationId) {
    console.warn('[MailerLite] triggerAutomation: automationId is empty, skipping');
    return null;
  }

  const data = await mlFetch(`/automations/${automationId}/enroll`, {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
  });

  console.log(`[MailerLite] Automation triggered for: ${email}`);
  return data;
}

// ═══════════════════════════════════════════════════════════
// updateSubscriberField
// Updates custom fields on a subscriber (e.g. plan, lifecycle).
// ═══════════════════════════════════════════════════════════
export async function updateSubscriberField(
  email: string,
  fields: Record<string, string | number | boolean>
) {
  const data = await mlFetch('/subscribers', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      fields,
      resubscribe: false,
    },
  });
  return data?.data;
}

// ═══════════════════════════════════════════════════════════
// unsubscribe
// Marks a subscriber as unsubscribed.
// ═══════════════════════════════════════════════════════════
export async function unsubscribeEmail(email: string) {
  // First find the subscriber
  const search = await mlFetch(
    `/subscribers?filter[email]=${encodeURIComponent(email)}`
  );
  const subscriber = search?.data?.[0];
  if (!subscriber) return null;

  const data = await mlFetch(`/subscribers/${subscriber.id}`, {
    method: 'PUT',
    body: { status: 'unsubscribed' },
  });
  return data?.data;
}
