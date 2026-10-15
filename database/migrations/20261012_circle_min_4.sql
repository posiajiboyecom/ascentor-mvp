-- A Circle can begin its calls and 90-day cycle with 4 members instead of 6.
-- Rewrites the two join functions in place (so nothing else about them changes), then starts any Circle that already has 4 or 5.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.rx_assign_circle(uuid)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'v_n >= 6', 'v_n >= 4');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.rx_join_circle(uuid, uuid, integer)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'v_n + 1 >= 6', 'v_n + 1 >= 4');
  EXECUTE v_def;
END
$$;

UPDATE public.circles c
   SET status = 'active', cycle_start = COALESCE(c.cycle_start, current_date)
 WHERE c.status <> 'completed' AND c.cycle_start IS NULL
   AND (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = c.id AND s.role = 'member') >= 4;
