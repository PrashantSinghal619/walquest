import { formatAreaM2 } from "@/lib/format";
import type { LeaderboardRow } from "../page";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No territories claimed yet. Get out there and start walking!
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">
              Rank
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Walker
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Territories
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Ground claimed
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.user_id}
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 text-center">
                {i < 3 ? (
                  <span className="text-base">{MEDALS[i]}</span>
                ) : (
                  <span className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium">{row.display_name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {row.territory_count}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {formatAreaM2(row.total_area_m2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
