---
description: Review walquest code changes for correctness, security, and consistency. Use when asked "review this", "is this safe?", or before committing to a critical path. Covers coordinate order, auth guards, PostGIS RPC usage, cache invalidation, and RLS coverage.
---

@../../../.agents/skills/code-review.md

Apply the above checklist to the staged or recently changed files. Report findings as: [BLOCKER] must fix before merging, [WARNING] should fix, [NOTE] optional improvement. Stop at the first BLOCKER and explain exactly what to change.
