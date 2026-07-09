"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/map", label: "Map" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

// Client island for the nav links only - the rest of the header stays in
// the Server Component layout. usePathname keeps the active state in sync
// on client navigations without any server round-trip.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-sm transition-colors",
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
