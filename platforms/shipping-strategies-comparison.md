# Mobile shipping strategies compared

Research checked 21 October 2026. This compares options; it does not replace the
accepted [build plan](mobile-build-plan.md). Recommendations below are engineering
judgment for Walquest, not measured performance results.

## Current strategy and alternatives

Our strategy is milestone-based cloud builds, with daily JavaScript iteration in
an installed development client. The internal allocation is 12 milestone jobs,
one necessary experiment and **two unforeseen buffer jobs**, across both platforms.
Expo's actual Free allowance is 15 Android and 15 iOS builds, separately, with a
low-priority queue. Starter currently costs $19/month plus additional usage,
includes $45 build credit and offers high-priority queue access.
[Expo pricing](https://expo.dev/pricing)

These choices overlap: build provider, release cadence and update delivery are
separate decisions. Using CI or EAS Update does not require abandoning Expo.

| Strategy | Advantages for Walquest | Tradeoffs and appropriate timing |
| --- | --- | --- |
| **Current: Free EAS milestone batches** | Minimal build infrastructure; explicit budget; each artifact has a measurable field test. | Native feedback arrives only after submission. A failed batch can consume scarce retries. Appropriate for the initial feasibility phase if local work continues during waits. |
| **Paid EAS with smaller native batches** | Higher queue priority; native integrations can be tested separately and more often. | Subscription and usage costs; priority is not a promised turnaround. Worth considering when waiting repeatedly prevents planned device tests. [Pricing](https://expo.dev/pricing) |
| **Local Android, cloud iOS** | Android experiments avoid EAS queue and cloud quota; retain cloud iOS builds from Windows. | Requires Android SDK/toolchain maintenance and local machine capacity. `npx expo run:android` is the relevant local development path. `eas build --local` is different: Windows is not officially supported, although WSL can be used. iOS local compilation requires macOS/Xcode. [Local development](https://docs.expo.dev/guides/local-app-development/), [EAS local limitations](https://docs.expo.dev/build-reference/local-builds/) |
| **Stable native binary + EAS Update** | Compatible JavaScript and asset changes reach remote testers without another native build or a running Metro server. Particularly useful for map UI, leaderboard and claim-flow iteration after native foundations stabilize. | Requires installing/configuring `expo-updates` and building that configuration into an app. Native dependency or permission changes still require a binary. Runtime compatibility, testing and update recovery need explicit management. [Setup](https://docs.expo.dev/eas-update/getting-started/), [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/) |
| **CI with a scheduled release train** | Run checks on every PR; build only approved weekly/milestone candidates. Gives repeatable release steps and a predictable tester cadence. | Triggering EAS from CI still uses EAS builds and its queue; automation alone saves neither quota nor compilation. A build on every commit would conflict with our budget. [EAS from CI](https://docs.expo.dev/build/building-on-ci/) |
| **Other CI or self-hosted builds with fastlane** | Own the runner capacity and customize signing, testing and release automation. Expo apps can be built by other capable CI services. | We take responsibility for runners, credentials, SDK upgrades and caches; iOS needs a suitable Mac environment. Hosted compute or hardware replaces EAS costs. Excess setup for our present stage. [Expo production builds](https://docs.expo.dev/deploy/build-project/), [fastlane](https://docs.fastlane.tools/) |

## Timing and integration risk

Track upload, queue, worker execution and installation separately. The plan's
15–30 minute Android and 20–40 minute iOS estimates are provisional worker
allowances, not observed benchmarks. Queue time remains unknown; paying for
priority changes scheduling, while local compilation removes the EAS queue.
Neither establishes compilation speed without measurements.

Frontloading required native capabilities can reduce rebuilds, but adding
speculative SDKs increases the compatibility surface and makes failures harder to
isolate. M1 already combines maps, background tasks, SQLite, secure storage, auth
and deep links. Implement these in small commits with individual smoke probes;
the cloud artifact can contain the completed batch. Use the named experiment
slot if a map/location compatibility question needs an earlier device build.

## Recommendation

Keep the chosen Free EAS strategy and both buffer jobs. Continue frequent commits,
automated checks and Metro-based iteration between builds. A build milestone is
a distribution checkpoint, not a reason to accumulate untested implementation.

EAS Update is the strongest complementary option once background recording and
the native baseline work. Decide separately whether remote tester feedback warrants
adding its configuration to a future planned binary. It is not enabled by this note.

Revisit the strategy when recorded queue waits repeatedly block field tests,
native changes exhaust the planned allocation, or remote testers need frequent
compatible updates. Choose paid EAS for queue pressure, local Android for repeated
native debugging, and Update for JavaScript distribution. Adopt a dedicated build
pipeline only when repeatability or scale justifies its maintenance.
