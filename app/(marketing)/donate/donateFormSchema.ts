import { z } from 'zod';

const sanitizeText = (val: string) => val.replace(/<[^>]*>?/gm, '').trim();

/**
 * Donation limits per currency. Donors in Nigeria give in naira; everyone else gives in US dollars (lib/geo.ts decides,
 * on the server). Below the minimum, Paystack fees eat most of the gift; above the maximum we ask donors to contact us.
 */
export const DONATION_LIMITS = {
  NGN: { min: 500, max: 5_000_000, presets: [5000, 10000, 25000, 50000, 100000], symbol: '\u20A6', name: 'NGN' },
  USD: { min: 5, max: 10_000, presets: [10, 25, 50, 100, 250], symbol: '$', name: 'USD' },
} as const;
export type DonationCurrency = keyof typeof DONATION_LIMITS;

const fields = (amount: z.ZodNumber) => ({
  full_name: z.string().trim().min(2, 'Full name is required').transform(sanitizeText),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  phone: z.string().trim().min(8, 'A valid phone number is required'),
  amount,
  message: z
    .string()
    .trim()
    .max(500, 'Please keep this under 500 characters')
    .transform(sanitizeText)
    .optional()
    .or(z.literal('')),
});

/** The form schema for a donor giving in `currency` (the minimum is shown in that currency). */
export function donateFormSchemaFor(currency: DonationCurrency) {
  const l = DONATION_LIMITS[currency];
  return z.object(fields(z.number().positive('Enter a donation amount').min(l.min, `The minimum donation is ${l.name} ${l.min.toLocaleString('en-US')}`)));
}

/** Naira form schema (kept for older imports). */
export const donateFormSchema = donateFormSchemaFor('NGN');

/** What the server accepts before it applies the limits of the donor's currency. */
export const donateRequestSchema = z.object(fields(z.number().positive('Enter a donation amount')));

export type DonateFormValues = z.infer<typeof donateFormSchema>;
