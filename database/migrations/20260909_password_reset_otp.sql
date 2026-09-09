-- password_reset_otps
-- Stores OTP codes for password reset flow (OTP-based, not session links)
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by email + OTP
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_code
  ON public.password_reset_otps (email, otp_code);

-- Auto-cleanup expired OTPs (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_reset_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- RLS: users can only see their own OTPs
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs"
  ON public.password_reset_otps FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access"
  ON public.password_reset_otps FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
