"use server";

import { createClient } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Server Action boundary - subscription JSON is untrusted client input
function isValidSubscription(sub: unknown): sub is PushSubscriptionInput {
  if (typeof sub !== "object" || sub === null) return false;
  const s = sub as Record<string, unknown>;
  const keys = s.keys as Record<string, unknown> | undefined;
  return (
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    typeof keys === "object" &&
    keys !== null &&
    typeof keys.p256dh === "string" &&
    typeof keys.auth === "string"
  );
}

export async function subscribePush(
  subscription: PushSubscriptionInput
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!isValidSubscription(subscription)) return { ok: false };

  // Re-subscribing from the same browser refreshes the keys in place.
  // If the endpoint belongs to a DIFFERENT account (shared browser), RLS
  // blocks the update and this returns ok:false - acceptable edge case.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("subscribePush failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (typeof endpoint !== "string" || !endpoint) return { ok: false };

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  return { ok: true };
}
