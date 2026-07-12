"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribePush, unsubscribePush } from "@/app/actions/push";

// web-push's applicationServerKey wants raw bytes, not base64url
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "checking" | "off" | "on" | "denied";

export function PushToggle() {
  const [state, setState] = useState<PushState>("checking");
  const [isPending, startTransition] = useTransition();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!) as BufferSource,
        });
        const result = await subscribePush(
          sub.toJSON() as Parameters<typeof subscribePush>[0]
        );
        if (!result.ok) {
          await sub.unsubscribe();
          setState("off");
          return;
        }
        setState("on");
      } catch {
        setState("off");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
      } catch {
        setState("off");
      }
    });
  }

  if (state === "unsupported" || state === "checking") return null;

  if (state === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications are blocked for this site - allow them in your browser
        settings to hear about territory attacks.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Territory alerts</p>
        <p className="text-xs text-muted-foreground">
          Get notified when someone clips your territory.
        </p>
      </div>
      {state === "on" ? (
        <Button variant="outline" size="sm" onClick={disable} disabled={isPending}>
          <BellOff /> {isPending ? "Turning off…" : "On"}
        </Button>
      ) : (
        <Button size="sm" onClick={enable} disabled={isPending}>
          <Bell /> {isPending ? "Enabling…" : "Enable"}
        </Button>
      )}
    </div>
  );
}
