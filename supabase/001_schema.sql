-- walquest Phase 4 schema
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.walks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'completed', 'discarded')),
  path        JSONB NOT NULL DEFAULT '[]',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  distance_m  FLOAT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walks_user_id_idx ON public.walks(user_id);

CREATE TABLE IF NOT EXISTS public.territories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  walk_id    UUID NOT NULL REFERENCES public.walks(id) ON DELETE CASCADE,
  geom       GEOMETRY(Polygon, 4326) NOT NULL,
  area_m2    FLOAT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territories_geom_idx   ON public.territories USING GIST(geom);
CREATE INDEX IF NOT EXISTS territories_owner_idx  ON public.territories(owner_id);

CREATE TABLE IF NOT EXISTS public.territory_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id      UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  walk_id           UUID REFERENCES public.walks(id)       ON DELETE SET NULL,
  actor_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('claimed', 'clipped', 'lost')),
  affected_owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  area_delta_m2     FLOAT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territory_events_created_at_idx ON public.territory_events(created_at);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_events  ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Users: public read"   ON public.users FOR SELECT USING (true);
CREATE POLICY "Users: own insert"    ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users: own update"    ON public.users FOR UPDATE  USING (auth.uid() = id);

-- walks
CREATE POLICY "Walks: own read"      ON public.walks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Walks: own insert"    ON public.walks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Walks: own update"    ON public.walks FOR UPDATE  USING (auth.uid() = user_id);

-- territories
CREATE POLICY "Territories: public read"  ON public.territories FOR SELECT USING (true);
CREATE POLICY "Territories: own insert"   ON public.territories FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Territories: own update"   ON public.territories FOR UPDATE  USING (auth.uid() = owner_id);
CREATE POLICY "Territories: own delete"   ON public.territories FOR DELETE  USING (auth.uid() = owner_id);

-- territory_events
CREATE POLICY "Events: public read"  ON public.territory_events FOR SELECT USING (true);
CREATE POLICY "Events: own insert"   ON public.territory_events FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ─── Auto-create user row on sign-up ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Helper RPCs ─────────────────────────────────────────────────────────────

-- Insert a territory polygon (accepts GeoJSON string so we stay in SQL-land)
CREATE OR REPLACE FUNCTION public.insert_territory(
  p_owner_id  UUID,
  p_walk_id   UUID,
  p_geom_json TEXT,
  p_area_m2   FLOAT
) RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.territories (owner_id, walk_id, geom, area_m2)
  VALUES (p_owner_id, p_walk_id, ST_GeomFromGeoJSON(p_geom_json), p_area_m2)
  RETURNING id;
$$;

-- Read all territories as a GeoJSON FeatureCollection
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
          'area_m2',    t.area_m2,
          'claimed_at', t.claimed_at
        )
      )
    ), '[]'::json)
  )
  FROM public.territories t;
$$;
