export function MapSkeleton() {
  return (
    <div className="relative flex-1 w-full overflow-hidden bg-muted animate-pulse">
      {/* Faint grid lines hint at a map without depending on any external resource */}
      <div className="absolute inset-0 opacity-[0.07]">
        {[20, 40, 60, 80].map((y) => (
          <div
            key={y}
            className="absolute w-full border-t border-foreground"
            style={{ top: `${y}%` }}
          />
        ))}
        {[20, 40, 60, 80].map((x) => (
          <div
            key={x}
            className="absolute h-full border-l border-foreground"
            style={{ left: `${x}%` }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground select-none">Loading map…</p>
      </div>
    </div>
  );
}
