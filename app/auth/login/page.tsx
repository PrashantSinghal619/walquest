import { Suspense } from "react";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

// searchParams is dynamic (per-request), so it must be awaited inside a
// Suspense boundary — same rule as any uncached async component.
// The heading and form are pure static JSX; they render before searchParams
// resolves and are never delayed.

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to walquest
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a magic link.
          </p>
        </div>

        {/* Flash messages resolve after searchParams — static form renders first */}
        <Suspense fallback={null}>
          <FlashMessages searchParams={searchParams} />
        </Suspense>

        <form action={signIn} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" className="w-full">
            Send magic link
          </Button>
        </form>
      </div>
    </div>
  );
}

async function FlashMessages({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;
  if (!message && !error) return null;
  return (
    <>
      {message && (
        <p className="rounded-md border border-primary/40 bg-primary/20 px-4 py-3 text-sm font-medium text-foreground">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/20 px-4 py-3 text-sm font-medium text-foreground">
          {error}
        </p>
      )}
    </>
  );
}
