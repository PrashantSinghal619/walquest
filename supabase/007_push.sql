-- walquest Phase 13: push notifications on territory loss
-- Run in Supabase Dashboard -> SQL Editor AFTER 006_walk_distance.sql
--
-- Just the subscriptions table - no RPC changes. completeWalk already
-- knows a claim hurt someone (clipped_count/lost_count from
-- claim_territory) and reads the per-owner details from
-- territory_events (walk_id + type + affected_owner_id + area_delta_m2).

-- One row per browser push endpoint. endpoint is globally unique (it IS
-- the browser's identity); p256dh/auth are the encryption keys web-push
-- needs. RLS restricts every session to its own rows - reading OTHER
-- users' subscriptions (to notify them) happens server-side in
-- completeWalk via the service-role key only.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Push: own read"   ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Push: own insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Push: own update" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Push: own delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
