import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { formatAreaM2 } from "@/lib/format";

/**
 * Server-side web-push dispatch for territory-loss notifications.
 *
 * Reading OTHER users' push subscriptions is deliberately impossible for the
 * claimer's own session (RLS: own rows only) - it requires the service-role
 * key. When SUPABASE_SERVICE_ROLE_KEY or the VAPID vars are absent, sending
 * silently no-ops so claims never depend on notification config.
 */

export type LossEvent = {
  ownerId: string;
  /** positive m² the owner lost to this claim */
  areaLostM2: number;
};

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

/** Pure - unit-testable without any push infrastructure. */
export function buildLossPayload(actorName: string, areaLostM2: number) {
  return {
    title: "Your territory is under attack!",
    body: `${actorName} walked off with ${formatAreaM2(areaLostM2)} of your ground. Walk it back!`,
    url: "/map",
    tag: "territory-loss",
  };
}

export async function notifyTerritoryLoss(
  actorName: string,
  losses: LossEvent[]
): Promise<void> {
  if (losses.length === 0 || !pushConfigured()) return;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // One notification per owner, aggregating their total loss from this claim
  const lossByOwner = new Map<string, number>();
  for (const loss of losses) {
    lossByOwner.set(loss.ownerId, (lossByOwner.get(loss.ownerId) ?? 0) + loss.areaLostM2);
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", [...lossByOwner.keys()]);
  if (!subs || subs.length === 0) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await Promise.allSettled(
    subs.map(async (sub) => {
      const payload = buildLossPayload(actorName, lossByOwner.get(sub.user_id) ?? 0);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 404/410 = the browser dropped the subscription - clean it up
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error("web-push send failed:", status ?? err);
        }
      }
    })
  );
}
