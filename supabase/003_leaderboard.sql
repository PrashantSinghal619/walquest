-- walquest Phase 6: leaderboard RPC
-- Run in Supabase Dashboard -> SQL Editor

-- Returns the top 20 walkers ranked by total territory area.
-- SECURITY DEFINER so it can read auth.users.email without exposing the
-- table directly via PostgREST. display_name is the username part of the
-- email (everything before @).
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id        UUID,
  display_name   TEXT,
  territory_count BIGINT,
  total_area_m2  FLOAT8
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    au.id                                AS user_id,
    split_part(au.email, '@', 1)         AS display_name,
    COUNT(t.id)::BIGINT                  AS territory_count,
    COALESCE(SUM(t.area_m2), 0)::FLOAT8 AS total_area_m2
  FROM auth.users au
  JOIN public.territories t ON t.owner_id = au.id
  GROUP BY au.id, au.email
  ORDER BY total_area_m2 DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;
