"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Chromium fires this before showing its own install UI; capturing it lets
// us offer install on our own button. Not in TS's DOM lib yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's non-standard flag for installed PWAs
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return; // already installed - offer nothing

    // iOS never fires beforeinstallprompt; the only path is Share -> Add
    // to Home Screen, so show a hint instead of a button.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setShowIOSHint(isIOS);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's mini-infobar; we render our own button
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (installEvent) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await installEvent.prompt();
          // Chrome only allows prompt() once per captured event
          setInstallEvent(null);
        }}
      >
        <Download /> Install the app
      </Button>
    );
  }

  if (showIOSHint) {
    return (
      <p className="text-xs text-muted-foreground">
        On iPhone: tap Share, then &ldquo;Add to Home Screen&rdquo; to install.
      </p>
    );
  }

  return null;
}
