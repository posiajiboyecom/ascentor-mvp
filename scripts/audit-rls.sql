-- scripts/audit-rls.sql
-- Paste into the Supabase SQL editor. Read-only. Shows, for every public table:
-- whether Row Level Security is on, how many policies exist, and whether the
-- anon / authenticated roles hold direct table privileges.
--
-- Anything with rls_enabled = false and anon_can_write = true is wide open to
-- anyone holding the public anon key (which ships in the browser bundle).

SELECT
  c.relname                                             AS table_name,
  c.relrowsecurity                                      AS rls_enabled,
  COALESCE(p.policy_count, 0)                           AS policies,
  has_table_privilege('anon', c.oid, 'SELECT')          AS anon_can_read,
  (has_table_privilege('anon', c.oid, 'INSERT')
   OR has_table_privilege('anon', c.oid, 'UPDATE')
   OR has_table_privilege('anon', c.oid, 'DELETE'))     AS anon_can_write,
  (has_table_privilege('authenticated', c.oid, 'INSERT')
   OR has_table_privilege('authenticated', c.oid, 'UPDATE')
   OR has_table_privilege('authenticated', c.oid, 'DELETE')) AS authed_can_write
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN (
  SELECT tablename, count(*) AS policy_count
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) p ON p.tablename = c.relname
WHERE c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;
