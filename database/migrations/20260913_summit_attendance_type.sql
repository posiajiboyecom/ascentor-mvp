-- Add attendance_type (onsite|virtual) to summit_registrations.
-- The rebuild migration created ticket_type (general/vip/speaker tiers),
-- which is a different concept. This column was never migrated.
ALTER TABLE summit_registrations
  ADD COLUMN IF NOT EXISTS attendance_type TEXT NOT NULL DEFAULT 'onsite';
