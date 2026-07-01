import { cacheLife } from "next/cache";

// Intentionally uncached — simulates a live data source that must stay fresh.
// Calling this from a component without Suspense should be caught by unstable_instant.
export async function getLiveWalkerCount(): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return 247; // would be a real DB query in production
}

/**
 * Marketing copy that rarely changes. A real version of this might read
 * from a CMS or database — caching it means that work happens once at
 * build/first-request time, not on every page load.
 */
export async function getLaunchTagline() {
  "use cache";
  cacheLife("hours");

  // Simulate a slow data source (CMS, DB, etc).
  await new Promise((resolve) => setTimeout(resolve, 50));

  return "A real-time territory game for Bengaluru's walkers and runners.";
}
