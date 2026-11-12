# walquest workstreams

The web app is the existing `develop` baseline. Feature PRs target `develop`;
promotion to `master` uses a separate PR. Publishing branches does not deploy or merge them.

| Work | Branch | Dependency |
| --- | --- | --- |
| Public web demo (part of the web app) | `codex/web-demo` | `develop` |
| Shared geometry, formatting and recording contracts | `codex/shared-domain` | `develop` |
| Native recording, authentication and build foundation | `codex/mobile-foundation` | `codex/shared-domain` |
| Shared lowercase naming instructions | `codex/branding` | `develop` |
| Mobile names, permission prompts and messages | `codex/mobile-branding` | `codex/mobile-foundation` |
| Mobile walk/account screens, theme and step estimates | `codex/mobile-ui` | `codex/mobile-branding` |
| Repository hygiene and preserved architecture notes | `codex/devops-repository-hygiene` | `develop` |

Mobile branches are stacked. Their PRs include prerequisite commits until those
merge; integrate shared-domain, mobile-foundation, mobile-branding and mobile-ui
in that order. Rebase dependents onto the latest develop after each prerequisite
merges. The shared naming instructions also appear in mobile-branding.

The mobile foundation already contains CI checks, EAS upload configuration and
build acceptance planning. Keep those dependent changes with that foundation.
The DevOps branch scopes local artifacts out of Git and web checks.

## Local artifacts

`.local/` contains build-upload inspections, backup manifests, historical PR/issue
drafts and a linked worktree. These files are preserved locally and excluded from
source control. The architecture rationale that previously existed only there is
preserved in [architecture-summary.md](./architecture-summary.md).

Mobile dependency installations, Expo caches, exported bundles and generated native
projects are ignored build artifacts. Environment files remain local. The mobile
foundation tracks a sanitized `.env.example` separately.

Current mobile source, font licenses, the acceptance record and the future step-counter
brief are committed to `codex/mobile-ui`. Archived upload copies remain historical
snapshots. The current step count is a distance estimate; phone sensor integration
and full physical-device acceptance remain open work.
