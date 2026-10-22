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
