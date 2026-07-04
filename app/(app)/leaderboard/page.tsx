import { cacheTag, cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { LeaderboardTable } from "./_components/leaderboard-table";

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  territory_count: number;
  total_area_m2: number;
};

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard();
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Who owns Bengaluru? Top walkers by ground claimed.
        </p>
      </div>
      <LeaderboardTable rows={rows} />
    </div>
  );
}

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  "use cache";
  cacheTag("leaderboard");
  cacheLife("minutes");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data } = await supabase.rpc("get_leaderboard");
  return (data ?? []) as LeaderboardRow[];
}
