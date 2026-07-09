import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { UserMenuDropdown } from "./user-menu-dropdown";
import type { cookies } from "next/headers";

type CookieStorePromise = ReturnType<typeof cookies>;

interface UserMenuProps {
  cookiePromise: CookieStorePromise;
}

// This is an async Server Component - it can await the cookie promise because
// it lives inside a <Suspense> boundary in the layout. The layout rendered its
// static shell before this component was even started. Suspending here does
// not delay the header chrome or any other sibling content.
export async function UserMenu({ cookiePromise }: UserMenuProps) {
  const cookieStore = await cookiePromise;

  // Build a read-only Supabase client from the already-resolved cookie store.
  // setAll is a no-op here - we're only reading session data during render.
  // Cookie writes (session refresh) happen in proxy.ts on every request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
    );
  }

  const email = user.email ?? "";
  const name =
    (user.user_metadata?.display_name as string | undefined) ??
    (email ? email.split("@")[0] : "Walker");
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return <UserMenuDropdown name={name} email={email} avatarUrl={avatarUrl} />;
}
