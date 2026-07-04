import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "./_components/user-menu";
import { Providers } from "./providers";

// Why cookies() is called here but not awaited:
//
// Under cacheComponents: true, calling cookies() in this layout marks the
// route as dynamic - it re-runs on every request. That's unavoidable because
// the nav must reflect the current user's session.
//
// But we don't await it at the top of this function. Instead we pass the
// Promise down to <UserMenu>, which is wrapped in Suspense. This means:
//
//   1. The nav chrome (logo, links, ThemeToggle) renders synchronously and
//      reaches the browser as the static shell - fast first paint.
//   2. UserMenu suspends while it awaits the cookie store + Supabase call.
//      The fallback skeleton streams in, then swaps out when the user
//      session resolves. LCP is never blocked.
//
// The alternative - awaiting cookies() here - would block the entire layout
// render until the cookie store is ready, delaying even the logo.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cookiePromise is a Promise<ReadonlyRequestCookies>. We do NOT await it.
  const cookiePromise = cookies();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            walquest
          </Link>
          <Link
            href="/map"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Map
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Leaderboard
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {/* UserMenu awaits the cookie promise and shows user/logout.
              The skeleton keeps the header height stable while it loads. */}
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu cookiePromise={cookiePromise} />
          </Suspense>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}

function UserMenuSkeleton() {
  return (
    <div className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-hidden />
  );
}
