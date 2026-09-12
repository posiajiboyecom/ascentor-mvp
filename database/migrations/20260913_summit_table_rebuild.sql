DROP TABLE IF EXISTS summit_registrations;

CREATE TABLE summit_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  location TEXT NOT NULL,
  organisation TEXT NOT NULL,
  "current_role" TEXT NOT NULL,
  other_messages TEXT,
  consent BOOLEAN NOT NULL DEFAULT false,

  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT UNIQUE,
  amount_paid NUMERIC,
  currency TEXT DEFAULT 'NGN',
  flutterwave_tx_id TEXT,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,

  ticket_type TEXT,
  notes TEXT,
  user_id UUID,
  source TEXT NOT NULL DEFAULT 'web',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_summit_registrations_payment_reference ON summit_registrations (payment_reference);
CREATE INDEX IF NOT EXISTS idx_summit_registrations_email ON summit_registrations (email);
