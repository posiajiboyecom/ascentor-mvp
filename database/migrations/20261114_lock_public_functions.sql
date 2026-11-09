-- These functions change data with elevated rights and were callable by anyone holding the public (anon) key.
-- The app only calls them from the server with the service role, so browsers no longer can.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('process_referral_reward', 'claim_promo_code', 'use_promo_code', 'increment_promo_usage',
      'increment_post_upvotes', 'increment_reply_upvotes', 'validate_promo_code')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Waitlist reports (names and emails) are for admins only.
REVOKE ALL ON public.waitlist_top_referrers FROM anon, authenticated;
REVOKE ALL ON public.waitlist_stats FROM anon, authenticated;
