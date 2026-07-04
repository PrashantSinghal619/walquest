import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroBackground } from "@/components/hero-background";
import { getLaunchTagline, getLiveWalkerCount } from "@/lib/content/stats";

export const unstable_instant = { prefetch: "static" };

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">
          walquest
        </span>
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center">
        <HeroBackground />
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
          Walk it. Claim it. Defend it.
        </h1>
        {/*
         * Tagline is async + 'use cache'. The Suspense boundary is still
         * required - unstable_instant validates structure, not whether the
         * cache will be warm. The fallback is sized to match so there's no
         * CLS when the cached content resolves.
         */}
        <Suspense fallback={<TaglineSkeleton />}>
          <Tagline />
        </Suspense>
        {/*
         * LiveBadge is uncached (fresh per-request data). Wrapping it in
         * Suspense lets the static shell paint immediately while the live
         * count streams in - this is the correct pattern for mixing cached
         * and dynamic content on the same page.
         */}
        <Suspense fallback={<div className="h-5 w-48 animate-pulse rounded bg-muted" />}>
          <LiveBadge />
        </Suspense>
        <Button size="lg" asChild>
          <Link href="/auth/login">Get started</Link>
        </Button>
      </main>
    </div>
  );
}

async function Tagline() {
  const tagline = await getLaunchTagline();
  return <p className="text-muted-foreground max-w-md text-lg">{tagline}</p>;
}

// No 'use cache', no Suspense wrapping it at call site - will block instant nav
async function LiveBadge() {
  const count = await getLiveWalkerCount();
  return (
    <p className="text-sm text-muted-foreground">
      {count} walkers active right now
    </p>
  );
}

function TaglineSkeleton() {
  return (
    <div className="h-7 w-80 max-w-md animate-pulse rounded-md bg-muted" />
  );
}
