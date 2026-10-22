// Request bodies for the billing v2 member API (/api/billing/*). Strict: unknown keys are rejected.
import { z } from 'zod';

export const billingCardVerify = z.strictObject({ reference: z.string().trim().min(6).max(120) });
export const billingCardDefault = z.strictObject({ cardId: z.string().uuid() });
export const billingCardRemove = z.strictObject({ cardId: z.string().uuid() });
export const billingTrialStart = z.strictObject({
  tier: z.enum(['explorer', 'builder']),
  cycle: z.enum(['monthly', 'yearly']),
});
export const billingPlanChange = z.strictObject({
  tier: z.enum(['explorer', 'builder']).optional(),
  cycle: z.enum(['monthly', 'yearly']).optional(),
});

// Groups: join with a code OR a link token (exactly one).
export const billingGroupJoin = z.strictObject({
  code: z.string().trim().min(4).max(24).optional(),
  token: z.string().trim().min(16).max(64).optional(),
}).refine((v) => !!v.code !== !!v.token, { message: 'Send a code or a link token, not both.' });

// Card check: where Paystack sends the member back to. 'settings' is the Billing screen, 'checkout' is the v2 checkout.
export const billingCardStart = z.strictObject({ returnTo: z.enum(['settings', 'checkout']).optional() });
