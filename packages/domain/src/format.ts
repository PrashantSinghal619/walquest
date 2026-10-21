/**
 * Shared display formatting for territory data (map popups, profile stats).
 * Locale is pinned to en-IN so output is deterministic in tests and
 * consistent for the Bengaluru audience.
 */

/**
 * Below 10,000 m² (a hectare): whole m². At or above: km² - with three
 * decimals under 1 km² so small territories keep meaningful precision
 * (17,444 m² -> "0.017 km²"), two decimals from 1 km² up.
 */
export function formatAreaM2(areaM2: number): string {
  if (areaM2 < 10_000) {
    return `${Math.round(areaM2).toLocaleString("en-IN")} m²`;
  }
  const km2 = areaM2 / 1_000_000;
  return `${km2.toFixed(km2 >= 1 ? 2 : 3)} km²`;
}

export function formatDistanceM(distanceM: number): string {
  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distanceM)} m`;
}

/** Duration between two ISO timestamps, e.g. "42 min" or "1 h 05 min". */
export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "—";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
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
