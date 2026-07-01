// Phase 3 will replace this with the real MapLibre map island.
// For now it's a placeholder so the /map route exists and the proxy
// has something to redirect to after a successful sign-in.

export default function MapPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
        🗺️
      </div>
      <h1 className="text-xl font-semibold">Map coming in Phase 3</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        MapLibre + OpenFreeMap territory view will be built next. For now,
        you&apos;re authenticated — the nav above shows your session.
      </p>
    </div>
  );
}
