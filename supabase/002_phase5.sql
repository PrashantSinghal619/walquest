-- walquest Phase 5 migration
-- Run this in Supabase Dashboard → SQL Editor AFTER 001_schema.sql

-- ─── Conflict-resolving territory claim ───────────────────────────────────────
--
-- Replaces the simple insert_territory() RPC. Runs entirely inside Postgres so
-- the intersection check, clipping, and new-territory insert are atomic.
--
-- Algorithm:
--   For each existing territory that ST_Intersects the incoming polygon
--     (skipping the caller's own territories):
--       diff = ST_Difference(existing, incoming)
--       if diff area < 500 m²  → delete existing, emit 'lost' event
--       else                   → update existing to diff, emit 'clipped' event
--   Then insert the new territory and emit a 'claimed' event.
--
-- Returns JSON: { territory_id, clipped_count, lost_count }

CREATE OR REPLACE FUNCTION public.claim_territory(
  p_owner_id  UUID,
  p_walk_id   UUID,
  p_geom_json TEXT,
  p_area_m2   FLOAT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_geom   GEOMETRY;
  v_rec        RECORD;
  v_new_id     UUID;
  v_clipped    INT := 0;
  v_lost       INT := 0;
  v_diff_geom  GEOMETRY;
  v_diff_area  FLOAT;
BEGIN
  -- Caller must be the declared owner
  IF auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_new_geom := ST_GeomFromGeoJSON(p_geom_json);

  -- Lock and process every overlapping territory owned by someone else
  FOR v_rec IN
    SELECT id, owner_id, geom, area_m2
    FROM public.territories
    WHERE ST_Intersects(geom, v_new_geom)
      AND owner_id <> p_owner_id
    FOR UPDATE
  LOOP
    -- Take the largest polygon piece remaining after the clip
    SELECT geom INTO v_diff_geom
    FROM ST_Dump(ST_Difference(v_rec.geom, v_new_geom))
    ORDER BY ST_Area(geom) DESC
    LIMIT 1;

    v_diff_area := COALESCE(ST_Area(v_diff_geom::geography), 0);

    IF v_diff_area < 500 THEN
      -- Territory fully consumed — remove it
      DELETE FROM public.territories WHERE id = v_rec.id;

      INSERT INTO public.territory_events
        (territory_id, walk_id, actor_id, type, affected_owner_id, area_delta_m2)
      VALUES
        (v_rec.id, p_walk_id, p_owner_id, 'lost', v_rec.owner_id, -v_rec.area_m2);

      v_lost := v_lost + 1;
    ELSE
      -- Clip surviving piece
      UPDATE public.territories
        SET geom       = v_diff_geom,
            area_m2    = v_diff_area,
            updated_at = now()
      WHERE id = v_rec.id;

      INSERT INTO public.territory_events
        (territory_id, walk_id, actor_id, type, affected_owner_id, area_delta_m2)
      VALUES
        (v_rec.id, p_walk_id, p_owner_id, 'clipped', v_rec.owner_id,
         -(v_rec.area_m2 - v_diff_area));

      v_clipped := v_clipped + 1;
    END IF;
  END LOOP;

  -- Insert the new territory
  INSERT INTO public.territories (owner_id, walk_id, geom, area_m2)
  VALUES (p_owner_id, p_walk_id, v_new_geom, p_area_m2)
  RETURNING id INTO v_new_id;

  -- Claim event (drives leaderboard in Phase 6)
  INSERT INTO public.territory_events
    (territory_id, walk_id, actor_id, type, area_delta_m2)
  VALUES
    (v_new_id, p_walk_id, p_owner_id, 'claimed', p_area_m2);

  RETURN json_build_object(
    'territory_id',  v_new_id,
    'clipped_count', v_clipped,
    'lost_count',    v_lost
  );
END;
$$;

-- ─── Enable Realtime on territory_events ─────────────────────────────────────
-- Clients subscribe to INSERTs here to know when to refresh the map.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'territory_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.territory_events;
  END IF;
END
$$;
