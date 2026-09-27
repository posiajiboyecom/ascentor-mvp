import { z } from 'zod';

const sanitizeText = (val: string) => val.replace(/<[^>]*>?/gm, '').trim();

export const donateFormSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required').transform(sanitizeText),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  phone: z.string().trim().min(8, 'A valid phone number is required'),
  amount: z
    .number()
    .positive('Enter a donation amount')
    .min(500, 'The minimum donation is NGN 500'),
  message: z
    .string()
    .trim()
    .max(500, 'Please keep this under 500 characters')
    .transform(sanitizeText)
    .optional()
    .or(z.literal('')),
});

export type DonateFormValues = z.infer<typeof donateFormSchema>;
