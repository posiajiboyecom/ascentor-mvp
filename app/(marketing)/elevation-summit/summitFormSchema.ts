import { z } from 'zod';

const sanitizeText = (val: string) => val.replace(/<[^>]*>?/gm, '').trim();

export const summitFormSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required').transform(sanitizeText),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  whatsapp: z.string().trim().min(8, 'WhatsApp number is required'),
  location: z.string().trim().min(2, 'Location is required').transform(sanitizeText),
  organisation: z.string().trim().min(1, 'Current company is required').transform(sanitizeText),
  current_role: z.string().trim().min(1, 'Current role is required').transform(sanitizeText),
  other_messages: z
    .string()
    .trim()
    .max(1000, 'Please keep this under 1000 characters')
    .transform(sanitizeText)
    .optional()
    .or(z.literal('')),
  consent: z.boolean().refine((val) => val === true, {
    message: 'You must accept the privacy policy to register',
  }),
});

export type SummitFormValues = z.infer<typeof summitFormSchema>;
