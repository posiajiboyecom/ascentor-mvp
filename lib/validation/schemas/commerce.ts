// lib/validation/schemas/commerce.ts
// Request schemas for donations and the shop. (Plans are bought through Billing v2: lib/validation/schemas/billing.ts.)
import { z, uuid, paymentReference, planId, billingCycle, email as emailField, text as textField, optionalText as optionalTextField } from '../common';
import { SHOP_SHIPPING_KEYS } from '@/lib/shop-shared';
import { donateFormSchema } from '@/app/(marketing)/donate/donateFormSchema';

export const donateInitiate = donateFormSchema.strict();

export const donateVerify = z.strictObject({
  reference: paymentReference,
  donationId: uuid,
});

export const donateAbandon = donateVerify;


// ── Shop ─────────────────────────────────────────────────────────────────────
export const shopCheckout = z.strictObject({
  items: z.array(z.strictObject({
    productId: uuid,
    size: optionalTextField(8),
    qty: z.number().int().min(1).max(20),
  })).min(1).max(30),
  shipping: z.enum(SHOP_SHIPPING_KEYS as [string, ...string[]]).optional(),
  fullName: textField(120, 'Your name'),
  email: emailField,
  phone: optionalTextField(30),
  address: optionalTextField(300),
  city: optionalTextField(80),
  state: optionalTextField(80),
});

export const shopFree = z.strictObject({
  productId: uuid,
  fullName: textField(120, 'Your name'),
  email: emailField,
});
