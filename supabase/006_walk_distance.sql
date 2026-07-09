-- walquest Phase 10: backfill walk distances
-- Run in Supabase Dashboard -> SQL Editor AFTER 005_popups.sql
--
-- walks.distance_m existed since 001 but completeWalk never populated it,
-- so every historical walk has NULL - and the profile "Distance" stat
-- summed nulls as zero. New walks now store the distance at claim time
-- (computed with turf in the Server Action); this one-time backfill
-- computes it for old completed walks from their stored GPS path.
--
-- path is JSONB: an array of [lng, lat] pairs in recorded order.
-- WITH ORDINALITY preserves that order - ST_MakeLine on an unordered
-- subquery would connect points arbitrarily and inflate the distance.

UPDATE public.walks w
SET distance_m = sub.len
FROM (
  SELECT
    id,
    ST_Length(
      ST_MakeLine(ARRAY(
        SELECT ST_SetSRID(ST_MakePoint((p.value->>0)::float8, (p.value->>1)::float8), 4326)
        FROM jsonb_array_elements(path) WITH ORDINALITY AS p(value, ord)
        ORDER BY p.ord
      ))::geography
    ) AS len
  FROM public.walks
  WHERE distance_m IS NULL
    AND jsonb_array_length(path) >= 2
) sub
WHERE w.id = sub.id;
