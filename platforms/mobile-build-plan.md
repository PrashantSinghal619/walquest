# Mobile milestones and EAS build budget

Decision recorded 21 October 2026: use EAS cloud builds initially. Batch meaningful
features and native integration work so the free allowance supports development.
This is the current planning policy. The local mobile foundation is in progress;
no EAS build has been submitted. Implementation status is recorded in
[mobile-implementation.md](./mobile-implementation.md).

First build target: Moto G45 5G running Android 15. Keep iPhone 16 / iOS 26.6
configuration ready; Apple enrollment and iOS device builds are deferred.
Expo owner is `prashant.singhal`; local CLI login and project linking are pending. Submit a platform job only when its device
and signing prerequisites are ready. M1 is tracked in GitHub issue #3.

## Budget

Expo currently lists 15 Android and 15 iOS builds per month on Free, with a
low-priority queue. Track these separately and check actual account usage/reset
dates before scheduling. Other projects on the account may consume availability.

Until test-device priorities are confirmed, plan conservatively for **at most
15 build jobs total in a monthly cycle**, even though the published platform
allowances are separate. One Android artifact plus one iOS artifact is two jobs.

- Six milestone batches, up to two platform jobs each: 12 planned jobs.
- One conditional job for a necessary, focused integration experiment. Use it
  only when a named uncertainty cannot be resolved within a milestone build.
- Two buffer jobs reserved for unforeseen build requirements, including diagnosed
  native failures. Keep them outside planned milestone and experiment scope.
- Total allocation: 12 milestone jobs + 1 conditional experiment + 2 buffer jobs
  = 15. An unused experiment job stays unused; it need not become another release.
- Build only for a platform with an available tester/device and signing setup.
  Unused platform jobs stay available; they are not a reason to invent a build.
- This is a quota allocation, not a promise to finish all milestones in one month.
  Carry unfinished milestones forward when readiness or account limits require it.
- Count every submission against our internal budget until the EAS usage view
  establishes whether it consumed quota. Record failures and cancellations too.
- No build on every commit or PR. No automatic retry loop. Retry after identifying
  a cause and a corrective change, or confirming a transient service failure.

## Time estimates

Total delivery time = upload + queue wait + worker execution + download/install.
The ranges below estimate **worker execution only** (dependency installation,
native compilation, bundling and artifact preparation). They are provisional
engineering allowances, not Expo benchmarks or a service guarantee. There is no
Walquest build history yet; confidence is low.

Record queue time separately as **unknown; potentially hours on Free**. A small
change does not buy higher queue priority. Smaller dependency graphs and upload
archives help build work, but cannot guarantee a short queue. Do useful local
development while a job waits; avoid cancelling and resubmitting just to chase
a shorter queue.

After the first successful build on each platform, replace assumptions with the
observed time and a margin. After three comparable builds, use their range plus
25% headroom, noting cold-cache and signing differences. If worker execution
exceeds 40 minutes, inspect phase timings before adding more native dependencies;
that is an investigation trigger, not a timeout prediction.

## Milestones

Each row has at most one planned build per testable platform. A failed acceptance
test blocks promotion. Prefer fixes through the existing development client when
the native runtime is unchanged; an unforeseen necessary native rebuild uses the
two-job buffer. If the remaining budget cannot cover a milestone, reduce its
platform scope or carry it into the next cycle rather than pre-allocating buffer
jobs to planned work.

| Batch | Deliverable and native scope | Measurable outcome | Android worker estimate | iOS worker estimate | Jobs |
| --- | --- | --- | --- | --- | --- |
| M0 | Local preparation: choose a supported Expo SDK, audit dependency compatibility, configure profiles/signing, extract shared logic and define recording data. | Dependency/config checks and shared tests pass; target device and signing prerequisites are known. | No cloud build | No cloud build | 0 |
| M1 | Development client with Router, native MapLibre, Location + TaskManager, durable SQLite recording storage, secure session storage and app linking. Configure location purpose strings, background modes and Android location service. | Install and cold-launch 5 times; map renders; sign in and reopen with session preserved; a 20-minute walk including 15 minutes locked records timestamped samples to disk and reopens without losing saved samples. | 15–30 min | 20–40 min | 1–2 |
| M2 | Recovery and permission behavior; notification library/configuration if compatible and ready, otherwise the smallest isolated integration experiment. | Denial/revocation offers recovery without crashing; a 45-minute walk with 10 minutes offline retains all samples already saved; force-close/relaunch restores those samples and marks the missing interval; notification registration and test delivery pass if included. | 15–30 min | 20–40 min | 1–2 |
| M3 | First installable claim-loop preview, with bundled JS for use away from the development server. Hardened completion backend, map ownership, leaderboard and login connected. | On test data, two players complete non-overlap, overlap and full-loss cases; one interrupted/retried submission creates exactly one completion; visible holdings and rankings reconcile with the database. Test actual SQL, not only mocks. | 15–30 min | 20–40 min | 1–2 |
| M4 | Player-facing beta: profile, history/replay, territory-loss notifications and recording status/error UX. Prefer existing native libraries. | Claim, inspect history, replay and rival-loss notification work end to end; notification opens the intended screen; at least three 30-minute test walks complete without losing saved route data. | 15–30 min | 20–40 min | 1–2 |
| M5 | Reliability candidate: tune recording, permissions and map data based on measurements; change native settings only where evidence requires it. | On each target OS, complete a 60-minute locked walk; record battery percentage-point loss, sample-gap distribution and route error against a known loop. Provisional targets: no unexplained gap over 30 seconds, distance error within 10%, battery loss at most 10 percentage points/hour. Investigate misses; document device/conditions and agree changes explicitly. | 15–30 min | 20–40 min | 1–2 |
| M6 | Signed release candidate for the chosen testing/store channel, with final permissions, identifiers and assets. | Installs through the target distribution channel; bundled app starts without Metro; auth, locked recording, claim and replay pass smoke tests; version/signing/privacy disclosures match the artifact. Store approval is a separate outcome. | 20–35 min | 25–45 min | 1–2 |

The repeated estimates intentionally reflect the same native dependency set.
More screens or commits do not automatically mean proportionally longer builds.
M1 is an essential feasibility experiment. If its dependency set has an unresolved
compatibility risk, use the conditional experiment job for a focused map/background-location
integration experiment rather than adding speculative libraries to it.

## Integrate native dependencies early, with evidence

Before M1, inspect compatibility for the selected Expo SDK and React Native
architecture; pin compatible versions through the package manager and keep the
lockfile. Include only libraries with a named use in the first milestones and
a smoke test. Validate configuration/plugin output and JS bundles locally before
spending a cloud build. These checks reduce risk but do not prove native linking.

M1 establishes the recording/auth/map foundation. M2 closes remaining planned
native integrations, especially notifications and credentials. Add notifications
to M1 only if compatibility, signing and a test path are ready; otherwise isolate
them in M2. Do not add analytics, purchases, background fetch, or other speculative
SDKs just to avoid a hypothetical later build.

Use one durable recording store and one session-persistence approach. Preserve
timestamps, accuracy and recording segments so later rules can detect gaps and
implausible movement. A force-terminated app is not assumed to keep recording.

Keep the cloud upload focused on the mobile app and required shared packages.
Exclude local notes, caches, logs and unrelated artifacts using a reviewed
`.easignore`, while retaining workspace dependencies and lockfiles.

## Work between cloud builds

Use the installed development client with Metro for compatible JavaScript,
TypeScript, UI and business-logic iteration. Rebuild when native code, native
dependencies, permissions/configuration or the required binary runtime changes.
An intentionally bundled preview/release is also a valid build: it gives testers
a complete milestone without depending on a running development server.

Backend fixes and shared logic tests can proceed without consuming EAS jobs.
EAS Update is not required for this plan; adopt it separately if remote JS-only
preview distribution becomes useful. Each submitted artifact must correspond to
one milestone or a documented necessary experiment, even when its native code
has not changed.

## Required build note

Before submitting, record this in the relevant GitHub issue or milestone:

```text
Milestone / issue:
Commit and included changes:
Platform / device / OS / EAS profile:
Why an existing build + Metro cannot answer this:
Outcome or experiment hypothesis:
Acceptance test and failure threshold:
Native libraries/configuration changed:
Preflight results (dependencies, config, bundles, relevant tests):
Estimated worker time: [range; measured or provisional]
Queue estimate: [current EAS indication, otherwise unknown; hours possible]
Upload/install allowance: [based on archive size and connection, or unknown]
Budget category: [milestone / conditional experiment / unforeseen buffer]
Remaining monthly jobs: [milestone / experiment / buffer; EAS platform allowance]
```

Afterwards append the EAS build ID/URL, actual queue and execution durations,
artifact size, device-test evidence, outcome and quota consumed. An experiment
must resolve a named uncertainty; a failed build must produce a diagnosis before
another submission. For M5, its measurement protocol and provisional targets are
reviewed before the walk, so the result cannot redefine success after the fact.

## Sources

Checked 21 October 2026:
- [Expo pricing](https://expo.dev/pricing): platform allowances and queue priority.
- [Using development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/): reuse the installed native runtime during JS iteration.
- [EAS limitations](https://docs.expo.dev/build-reference/limitations/): service constraints; recheck before relying on build limits.

Build-time ranges and device acceptance thresholds above are Walquest planning
assumptions. Revise them from measured builds and field tests.
