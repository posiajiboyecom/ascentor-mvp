import { z } from 'zod';

export const watchFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter the email you registered with').email('Enter a valid email address').toLowerCase(),
});

export type WatchFormValues = z.infer<typeof watchFormSchema>;
