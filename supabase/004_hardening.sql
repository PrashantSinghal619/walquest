-- walquest Phase: security hardening + self-overlap merge
-- Run in Supabase Dashboard -> SQL Editor AFTER 003_leaderboard.sql
--
-- Fixes three audit findings:
--   1. insert_territory() (001) was superseded by claim_territory() but never
--      dropped. It is SECURITY DEFINER with NO auth check - any caller could
--      insert territories for any owner with any geometry/area. DROP it.
--   2. claim_territory() trusted the client-supplied p_area_m2. It now
--      recomputes area from the geometry (ST_Area on geography) and rejects
--      sub-500 m² claims server-side. p_area_m2 stays in the signature for
--      API compatibility but is ignored.
--   3. Overlapping claims by the SAME owner used to coexist, double-counting
--      leaderboard area. They are now merged (ST_Union) into one territory.

-- ─── 1. Remove the unguarded legacy RPC ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.insert_territory(UUID, UUID, TEXT, FLOAT);

-- ─── 2 + 3. Hardened claim_territory ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_territory(
  p_owner_id  UUID,
  p_walk_id   UUID,
  p_geom_json TEXT,
  p_area_m2   FLOAT   -- advisory only; server recomputes from geometry
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_geom   GEOMETRY;
  v_area       FLOAT;
  v_rec        RECORD;
  v_new_id     UUID;
  v_clipped    INT := 0;
  v_lost       INT := 0;
  v_merged     INT := 0;
  v_own_area   FLOAT := 0;  -- area absorbed from caller's own territories
  v_diff_geom  GEOMETRY;
  v_diff_area  FLOAT;
BEGIN
  -- Caller must be the declared owner
  IF auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Walk must exist, belong to the caller, and still be in progress -
  -- prevents claiming against someone else's walk or re-claiming a
  -- finished one via a direct RPC call.
  IF NOT EXISTS (
    SELECT 1 FROM public.walks
    WHERE id = p_walk_id AND user_id = p_owner_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Invalid walk';
  END IF;

  v_new_geom := ST_GeomFromGeoJSON(p_geom_json);

  IF v_new_geom IS NULL
     OR GeometryType(v_new_geom) <> 'POLYGON'
     OR NOT ST_IsValid(v_new_geom) THEN
    RAISE EXCEPTION 'Invalid geometry';
  END IF;

  -- NEVER trust the client's area number - compute it from the geometry.
  v_area := ST_Area(v_new_geom::geography);
  IF v_area < 500 THEN
    RAISE EXCEPTION 'Territory too small';
  END IF;

  -- Clip every overlapping territory owned by someone else
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
      -- Territory fully consumed - remove it
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

  -- Merge the caller's own overlapping territories into the new claim.
  -- Only merge on genuine 2-D overlap (ST_Dimension = 2): every merged piece
  -- overlaps the new polygon in area, so the running union stays a single
  -- connected Polygon (possibly with holes) and fits the Polygon column.
  -- Corner-touch or edge-touch neighbours stay separate territories.
  FOR v_rec IN
    SELECT id, geom, area_m2
    FROM public.territories
    WHERE owner_id = p_owner_id
      AND ST_Intersects(geom, v_new_geom)
      AND ST_Dimension(ST_Intersection(geom, v_new_geom)) = 2
    FOR UPDATE
  LOOP
    v_new_geom := ST_Union(v_new_geom, v_rec.geom);
    v_own_area := v_own_area + v_rec.area_m2;
    -- Absorbed, not lost: no 'lost' event - the ground stays with the owner.
    DELETE FROM public.territories WHERE id = v_rec.id;
    v_merged := v_merged + 1;
  END LOOP;

  -- Recompute after the union - overlap means merged area < new + old sum
  v_area := ST_Area(v_new_geom::geography);

  -- Insert the (possibly merged) territory
  INSERT INTO public.territories (owner_id, walk_id, geom, area_m2)
  VALUES (p_owner_id, p_walk_id, v_new_geom, v_area)
  RETURNING id INTO v_new_id;

  -- Claim event records NET ground gained, not the merged total
  INSERT INTO public.territory_events
    (territory_id, walk_id, actor_id, type, area_delta_m2)
  VALUES
    (v_new_id, p_walk_id, p_owner_id, 'claimed', v_area - v_own_area);

  RETURN json_build_object(
    'territory_id',  v_new_id,
    'clipped_count', v_clipped,
    'lost_count',    v_lost,
    'merged_count',  v_merged,
    'area_m2',       v_area
  );
END;
$$;
