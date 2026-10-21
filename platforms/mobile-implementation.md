# Mobile implementation status

## M0 — local foundation

Started 21 October 2026. First target: Moto G45 5G on Android 15.
iPhone 16 / iOS 26.6 remains a target, with Apple enrollment/device builds deferred.
Expo owner: `prashant.singhal`; CLI login is pending. Branch: `codex/mobile-foundation`.
Tracking: [M1 issue #3](https://github.com/PrashantSinghal619/walquest/issues/3).

- Official Expo SDK 58 Router scaffold in `apps/mobile`.
- Pure geometry and formatting source in `packages/domain`; web imports forward
  to the same source. Existing geometry behavior is preserved, including the
  known physical loop-closure validation gap. Extraction does not fix claim rules.
- Recording types retain timestamps, accuracy, speed and interruption segments.
  M1 now persists these data in SQLite.
- Development, preview and production EAS profiles are declared.
- Next.js typechecking and linting exclude the independent mobile application.
- Existing web suite: 72 tests passed after extraction.
- npm workspaces link the apps and domain package through one root lockfile.
- Mobile typecheck and lint pass; Expo Doctor passes 20/20 checks.
- iOS JavaScript export succeeds (1,143 modules, 2.5 MB Hermes bundle).
- Config introspection confirms iOS `location` background mode and both location
  permission purpose strings. This does not prove native compilation or recording.

The initial dependency audit reported 51 findings across the workspace, including critical
findings for the existing web `next` and `maplibre-gl` packages and transitive
`proxy-addr`. Dependency remediation needs a separate reviewed change; no forced
audit upgrade was applied as part of this scaffold. Review the current audit before release.

## Before the first EAS submission

Confirm Expo account/project ownership, permanent Android application identifier
and signing credentials. For later iOS builds, also confirm the bundle identifier,
paid Apple Developer membership and registered test device.
No account identifier or project ID is guessed in app config.
Register the app's auth callback with Supabase when M1 auth is wired.
These prerequisites do not block local implementation.

M1 Android worker time: 15–30 minutes; later iOS: 20–40 minutes (both unmeasured). Queue wait unknown,
potentially hours. Submit only after dependency/config/bundle checks and a build
note from `mobile-build-plan.md`. No cloud build has been submitted by this work.
The two unforeseen-build reserves remain protected.

M1 acceptance on the Moto G45: five cold launches, map rendering, persisted
sign-in, and a 20-minute walk with 15 minutes locked. Inspect timestamps and
saved samples after reopening. Battery settings and permission state should be
recorded with the result. Force-stop is not assumed to permit continued tracking.

## M1 — map and recorder implementation

Implemented a native MapLibre route map and background location task, registered
at module scope through the root layout. The recorder uses SQLite transactions
and serializes background/UI operations. It saves raw timestamped coordinates,
accuracy, altitude and speed; duplicate, malformed and stale batches are ignored.

Start, pause, resume, finish/save, delete and explicit diagnostic sharing are
available. A pause/resume or sample gap over 30 seconds splits the route. Distance
and map lines exclude missing intervals. Foreground recovery checks permission,
precise-location access, location services and task registration. Task/storage
errors stop the native task where possible and retain previously committed data.
Saved walks are local and unauthenticated; no territory claim is sent.

Validation: nine SQLite tests pass using the same repository SQL on Node 24's
SQLite implementation, including on-disk reopen, transactional failure rollback,
serialized starts/callbacks, route-gap handling and deletion. These tests do not
exercise Expo's native bridge. Existing web tests: 72 passed. Mobile typecheck
and lint pass. Both Android and iOS JavaScript bundles compile; native compilation
and locked-phone behavior await the first development build.

On 22 October, added Supabase PKCE magic-link sign-in with a strict callback
parser, session restoration, foreground token refresh and local sign-out.
SecureStore holds immutable token chunks with a manifest publication step, so a
failed write keeps the preceding complete session. Seven auth/storage tests cover
Unicode/large sessions, interrupted writes, cleanup failures and callback rejection.
There are 16 mobile tests and 72 web tests, all passing. React and React DOM are
aligned to 19.3 across the workspaces; Next.js production build passes. Expo Doctor
passes 20/20 checks after compatible SDK 58 patch updates. Both native JS bundles
export at approximately 3.5 MB each. A separate scratch `npm ci --ignore-scripts`
validates clean installation of the final lockfile.

The application identifiers are configured as `com.prashantsinghal.walquest` for
Android and iOS. Owner `prashant.singhal` is configured; EAS project linking still
needs CLI login. `.easignore` restricts the upload to manifests and required mobile
workspaces. Actual EAS archive inspection is pending login; no archive acceptance
is claimed. CI now validates mobile tests/types/lint/bundles with Node 24 and
submits no EAS jobs. The existing web icons are reused for the native app.

Remaining in M1: authenticated Expo project linking, public EAS development
environment variables, Supabase callback allowlist, Android signing, native build
and physical acceptance. Software implementation is prepared; M1 stays open until
real-device evidence passes. See `mobile-m1-setup.md` for the exact setup/build
checklist and device protocol.
No EAS jobs consumed; two unforeseen-build reserves remain untouched.

## Sources checked during setup

- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/build/eas-json/
- https://maplibre.org/maplibre-react-native/docs/setup/expo/
