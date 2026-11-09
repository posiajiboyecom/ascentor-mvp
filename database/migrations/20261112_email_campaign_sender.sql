-- Which predefined sender a campaign goes out as: 'default' (settings name + main mailbox), 'greg', 'posi' or 'summit'.
-- Addresses live in lib/contact.ts (MARKETING_FROM, PERSONAL_FROM, SUMMIT_FROM).
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS sender text NOT NULL DEFAULT 'default'
  CHECK (sender IN ('default', 'greg', 'posi', 'summit'));
