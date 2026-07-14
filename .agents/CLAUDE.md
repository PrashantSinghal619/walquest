# Claude-specific project instructions

## Rule of thumb: generalize every failure into AGENTS.md

When a bug or incident is diagnosed - especially anything that reached production or cost a debugging session - do not stop at fixing the instance. Extract the general rule that would have prevented the whole CLASS of failure, and record it in AGENTS.md before moving on.

- The test for a good note: "would this have prevented the next occurrence, in a different spot?" (The maplibre-gl.css cascade trap bit the popup theme first; the instance was fixed without generalizing, and the same trap later shipped a fully blank map.)
- Format: symptom -> root cause -> the rule going forward, in one or two lines.
- Location: the section where someone doing related work would actually look (map notes for map traps, caching notes for cache traps) - not a graveyard appendix at the bottom.
- Same applies to operational lessons (stale `.next` cache, deploy quirks): record the symptom and the remedy the first time, not the second.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key divergences from Next.js <=15:
- Middleware file is `proxy.ts`, not `middleware.ts`; exported function is `proxy`, not `default`
- `cacheComponents: true` in `next.config.ts` inverts the default — all components are dynamic unless explicitly annotated with `'use cache'`
- `next/dynamic` with `{ ssr: false }` must be called from a `'use client'` file

## Next.js 16 cache API

All cache functions come from `next/cache`:
```typescript
import { cacheTag, cacheLife, updateTag, revalidateTag, revalidatePath } from 'next/cache'
```

Rules:
- `cacheTag('tag')` — must be called INSIDE a `'use cache'` function; tags the cache entry for targeted invalidation
- `cacheLife('minutes')` — sets cache lifetime; call inside `'use cache'`
- `updateTag('tag')` — call from a **Server Action** to invalidate + enable read-your-own-writes (the action sees fresh data immediately)
- `revalidateTag('tag')` — purges cache for next request; usable outside Server Actions

## `unstable_instant` — instant navigation validation

Export from page and layout files to validate that navigations produce an instant static shell. Validation runs in dev and at build time.

```typescript
// Page that should navigate instantly — no uncached server awaits at top level
export const unstable_instant = { prefetch: 'static' }

// Layout that is too dynamic for first-entry validation (reads cookies, etc.)
// Still allows sibling-navigation validation via page-level exports within this layout
export const unstable_instant = false
```

Rules:
- Add `unstable_instant = { prefetch: 'static' }` to any page that should be an instant navigation target
- Uncached data fetches (`await fetchSomething()` without `'use cache'`) must be inside `<Suspense>` OR the page is already `'use cache'`
- `loading.tsx` creates an implicit Suspense boundary — sufficient for cold-cache suspension of a `'use cache'` page function
- Layouts that call dynamic APIs (e.g. `cookies()`) should export `unstable_instant = false` so validation doesn't fail first-entry checks while still validating sibling navigations

Guide: `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`

## `'use cache'` + Supabase

Cached functions run outside request context — they cannot access cookies. This means `createClient()` from `lib/supabase/server` will fail inside `'use cache'` functions.

For public data (leaderboard, territory GeoJSON), use the plain supabase-js client:
```typescript
import { createClient } from '@supabase/supabase-js'

async function fetchPublicData() {
  'use cache'
  cacheTag('my-tag')
  cacheLife('minutes')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
  // ...
}
```
SECURITY DEFINER RPCs work fine with the anon key — they bypass RLS internally.

## TanStack Query error handling

Throwing in a `queryFn` does NOT automatically preserve previous data. Without configuration, `data` becomes `undefined` on error, falling back to whatever default you've set. To keep the last known-good data visible while errors/retries happen:

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['key'],
  queryFn: myFetchFn,   // should throw on non-OK responses
  placeholderData: keepPreviousData,
})
```

Always throw on non-OK responses (`if (!res.ok) throw new Error(...)`) — returning empty data on error makes TanStack Query cache the empty state as success, permanently blanking the UI until a real refetch.

## API route error handling

Route Handlers must return proper HTTP status codes on failure:
- Return `Response.json({ error: 'Generic message' }, { status: 500 })` — never 200 + empty payload
- Never expose raw DB/Postgres error messages in the response body (they leak schema details)
- Log the raw error server-side with `console.error` for Vercel log visibility

## public.users schema

`public.users` has only: `id`, `username`, `display_name`, `created_at`. There is NO email column. The `on_auth_user_created` trigger only inserts `id`.

To access emails, use a SECURITY DEFINER RPC that reads from `auth.users`:
```sql
SELECT split_part(au.email, '@', 1) as display_name
FROM auth.users au
JOIN public.territories t ON t.owner_id = au.id
```

## Turbopack `.next` cache

Turbopack can generate a corrupted `.next/dev/types/routes.d.ts` after config changes, causing routes to 404 even though their `page.tsx` files exist. If you see unexpected 404s on routes that clearly have page files, `rm -rf .next` and restart the dev server.

## Pre-commit guardrails

A `PreToolUse` hook fires on every `git commit` command. If staged files touch any critical path, it automatically invokes `/testing-strategy` and `/code-review` before allowing the commit.

BLOCKER and WARNING findings from the hook must be resolved before committing. `--no-verify` bypasses git hooks but NOT the Claude Code PreToolUse hook — to skip the hook you must commit from your own terminal, not through Claude Code's Bash tool.

See `.claude/settings.json` for the hook definition.

## PowerShell git commit syntax

`<<EOF` heredocs don't work in PowerShell. Use here-strings:
```powershell
git commit -m @'
commit message here
'@
```

Or use Bash tool with `$(cat <<'EOF' ... EOF)` syntax.

## Skills

Project-specific skill definitions live in `.agents/skills/` and are registered as Claude Code slash commands under `.claude/skills/`. Use `/testing-strategy` and `/code-review` when working on critical paths.
