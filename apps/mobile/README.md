# Walquest mobile

Expo SDK 58 development app. First target: Moto G45 5G, Android 15.
iPhone 16 / iOS 26.6 configuration is retained; its device build is deferred.

From the repository root:

```sh
npm install
npm run start --workspace @walquest/mobile
npm run typecheck --workspace @walquest/mobile
npm run lint --workspace @walquest/mobile
npm test
npm run test:mobile
```

The app reads shared TypeScript from `packages/domain`. npm workspaces and Expo's
Metro configuration resolve this package without copying business rules.

MapLibre and background location require a development client; Expo Go cannot
validate this app's native foundation. Start a walk to record timestamped GPS
samples into local SQLite. Pause/finish stops recording. Reopening recovers saved
points; resumed walks and long location gaps render as separate lines. Magic-link
sign-in uses the existing Supabase project and encrypted session storage.
Territory submission is not connected yet. Use the explicit share control to
inspect raw recording data during device tests.

Recorder tests use real SQLite through Node 24. Expo's native SQLite bridge and
background location still require physical-device validation.

Setup and first-build checklist: [M1 setup](../../platforms/mobile-m1-setup.md).
The development client needs Metro for loading JavaScript; do cold-launch and
recovery checks with Metro reachable. A later preview will bundle JavaScript for
standalone use.

EAS profiles are declared in `eas.json`. Run EAS commands from this directory.
Before an Android cloud build, link the intended Expo account/project and confirm
the permanent application identifier and signing. Later iOS device builds also
need Apple membership, bundle identifier and device registration. Complete the build note in
`platforms/mobile-build-plan.md`. No automatic build or submission is configured.
First Android execution estimate: 15–30 minutes; iOS later: 20–40 minutes.
Both are provisional and exclude unknown queue time.

See `platforms/mobile-implementation.md` at the repository root for milestone
status and device acceptance checks. Native compilation and locked-phone behavior
remain unverified until the first development build is installed and tested.
