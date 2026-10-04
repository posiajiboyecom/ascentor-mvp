// lib/validation/schemas/commerce.ts
// Request schemas for payments, promo codes and donations.
import { z, uuid, paymentReference, planId, billingCycle } from '../common';
import { donateFormSchema } from '@/app/(marketing)/donate/donateFormSchema';

export const payStart = z.strictObject({ planId, billing: billingCycle });

export const payPromo = z.strictObject({
  code: z.string({ error: 'Promo code is required.' }).trim().min(1, 'Promo code is required.').max(40).toUpperCase(),
});

export const payActivateFree = z.strictObject({
  planId,
  promoCode: z.string({ error: 'Promo code is required.' }).trim().min(1, 'Promo code is required.').max(40).toUpperCase(),
});

export const productVerify = z.strictObject({
  reference: paymentReference,
  productId: uuid,
});

export const donateInitiate = donateFormSchema.strict();

export const donateVerify = z.strictObject({
  reference: paymentReference,
  donationId: uuid,
});

export const donateAbandon = donateVerify;

