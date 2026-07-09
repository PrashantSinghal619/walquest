-- walquest Phase 9: territory popups
-- Run in Supabase Dashboard -> SQL Editor AFTER 004_hardening.sql
--
-- Adds owner_name to get_territories_geojson() properties so the map popup
-- can show who owns a territory. public.users.display_name is null for
-- everyone (the sign-up trigger only inserts id), so the name is derived
-- from auth.users.email the same way the leaderboard does: the part before
-- the @. The function is already SECURITY DEFINER, which is what lets it
-- read auth.users without exposing the table via PostgREST.

CREATE OR REPLACE FUNCTION public.get_territories_geojson()
RETURNS JSON LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', t.id,
        'geometry', ST_AsGeoJSON(t.geom)::json,
        'properties', json_build_object(
          'owner_id',   t.owner_id,
          'owner_name', split_part(au.email, '@', 1),
          'area_m2',    t.area_m2,
          'claimed_at', t.claimed_at
        )
      )
    ), '[]'::json)
  )
  FROM public.territories t
  LEFT JOIN auth.users au ON au.id = t.owner_id;
$$;
