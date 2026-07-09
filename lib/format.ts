/**
 * Shared display formatting for territory data (map popups, profile stats).
 * Locale is pinned to en-IN so output is deterministic in tests and
 * consistent for the Bengaluru audience.
 */

export function formatAreaM2(areaM2: number): string {
  if (areaM2 >= 1_000_000) {
    return `${(areaM2 / 1_000_000).toFixed(2)} km²`;
  }
  return `${Math.round(areaM2).toLocaleString("en-IN")} m²`;
}

export function formatClaimDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
