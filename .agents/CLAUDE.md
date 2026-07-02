# Claude-specific project instructions

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key divergences from Next.js ≤15:
- Middleware file is `proxy.ts`, not `middleware.ts`; exported function is `proxy`, not `default`
- `cacheComponents: true` in `next.config.ts` inverts the default — all components are dynamic unless explicitly annotated with `'use cache'`
- `next/dynamic` with `{ ssr: false }` must be called from a `'use client'` file

## PowerShell git commit syntax
`<<EOF` heredocs don't work in PowerShell. Use here-strings:
```powershell
git commit -m @'
commit message here
'@
```

## Pre-commit guardrails
A `PreToolUse` hook fires on every `git commit` command. If staged files touch any critical path, it automatically invokes `/testing-strategy` and `/code-review` before allowing the commit. See `.claude/settings.json` for the hook definition.

## Skills
Project-specific skill definitions live in `.agents/skills/` and are registered as Claude Code slash commands under `.claude/skills/`. Use `/testing-strategy` and `/code-review` when working on critical paths.
