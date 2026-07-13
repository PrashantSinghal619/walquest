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
    // overflow-x-auto is a safety net; the column rules below are meant to
    // keep everything within a phone viewport without scrolling
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="w-10 px-2 py-3 text-left font-medium text-muted-foreground sm:w-12 sm:px-4">
              Rank
            </th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground sm:px-4">
              Walker
            </th>
            {/* Secondary metric - drops off on phones; area is the ranking */}
            <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground sm:table-cell">
              Territories
            </th>
            <th className="px-2 py-3 text-right font-medium text-muted-foreground sm:px-4">
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
              <td className="px-2 py-3 text-center sm:px-4">
                {i < 3 ? (
                  <span className="text-base">{MEDALS[i]}</span>
                ) : (
                  <span className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                )}
              </td>
              {/* max-w + truncate keeps long email-prefix names from
                  forcing the table wider than the viewport */}
              <td
                className="max-w-[8.5rem] truncate px-2 py-3 font-medium sm:max-w-none sm:px-4"
                title={row.display_name}
              >
                {row.display_name}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                {row.territory_count}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums font-medium sm:px-4">
                {formatAreaM2(row.total_area_m2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
