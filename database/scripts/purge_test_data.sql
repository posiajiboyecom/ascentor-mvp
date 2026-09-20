-- ============================================================================
-- purge_test_data.sql   *** REVIEW BEFORE RUNNING - NOT a migration ***
--
-- Removes test rows from the Summit / payments data so admin figures are exact.
-- Run STEP 1 first, read every row, edit the WHERE list, then run STEP 2.
-- Nothing here touches a row that is a real paid customer unless you list it.
-- ============================================================================

-- STEP 1 ── PREVIEW. Everything you might want to delete. Real customers must
-- NOT appear here; if one does, remove them from the patterns in STEP 2.
SELECT id, full_name, email, whatsapp, payment_status, amount_paid, created_at
FROM public.summit_registrations
WHERE email ILIKE '%test%'
   OR email ILIKE '%example.com'
   OR full_name ILIKE '%test%'
   OR email IN (/* 'you@yourdomain.com', 'teammate@...' */ 'placeholder@invalid')
ORDER BY created_at DESC;

-- Money that Paystack shows as REAL is the source of truth. Cross-check every
-- 'paid' row above against the Paystack dashboard before deleting it.

-- STEP 2 ── DELETE (wrapped in a transaction; inspect counts, then COMMIT or ROLLBACK).
BEGIN;

CREATE TEMP TABLE _test_regs AS
SELECT id FROM public.summit_registrations
WHERE email ILIKE '%test%'
   OR email ILIKE '%example.com'
   OR full_name ILIKE '%test%'
   OR email IN ('placeholder@invalid');            -- <- add the team's own emails here

DELETE FROM public.payment_attempts
WHERE registration_id IN (SELECT id FROM _test_regs);

DELETE FROM public.summit_registrations
WHERE id IN (SELECT id FROM _test_regs);

-- Orphan attempts (registration already gone) and stale abandoned test checkouts.
DELETE FROM public.payment_attempts
WHERE kind = 'summit'
  AND registration_id IS NOT NULL
  AND registration_id NOT IN (SELECT id FROM public.summit_registrations);

SELECT (SELECT count(*) FROM _test_regs) AS test_registrations_removed;

-- Look at the counts above. If right:   COMMIT;
-- If anything looks wrong:              ROLLBACK;
-- COMMIT;
