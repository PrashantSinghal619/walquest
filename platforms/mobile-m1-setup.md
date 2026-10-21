# M1 setup and first Android build

The code is prepared for an Expo development client. Native compilation, sign-in
on a real phone and locked-screen recording still need device evidence.
Track results in [issue #3](https://github.com/PrashantSinghal619/walquest/issues/3).

## Account and app

Expo owner: `prashant.singhal`. Project slug: `walquest`.
Android application ID and reserved iOS bundle identifier:
`com.prashantsinghal.walquest`. These identifiers have not been published to a
store. First device: Moto G45 5G / Android 15. iPhone 16 / iOS 26.6 is deferred.

Use Node 24. Install from the repository root with `npm ci`. EAS commands run from
`apps/mobile`. Run `npx eas-cli@latest login` in your own terminal; keep passwords
and tokens there. Once authenticated, the project can be created/linked with:

```sh
npx eas-cli@latest project:init --account prashant.singhal --non-interactive
```

Verify that the returned project belongs to the intended account, then retain
the `extra.eas.projectId` written into `app.json`. This creates/links project
metadata; it does not submit a build.

## Supabase and public runtime settings

In the existing Supabase project's Authentication → URL Configuration, add this
exact Redirect URL while retaining the existing web entries:

```text
walquest://auth/callback
```

Magic links use PKCE. Request the link from the app, then open the newest email
on that same phone. Existing web sign-in keeps its HTTP callback.

Only these public settings belong in the app:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

For local Metro, put them in ignored `apps/mobile/.env.local`; an example file is
provided. The current workstation already has the public values copied from the
web environment. For cloud builds, create both values in the EAS `development`
environment with plaintext visibility. They are intentionally public and will be
included in client JavaScript. Never copy service-role keys, VAPID private keys,
or the complete web environment into the mobile app or EAS.

Sessions and PKCE verifiers use SecureStore, split into immutable small chunks
with an atomic manifest switch. Tokens are not stored in the recording database.
Sign-out stops recording and removes the local session pointer. Raw walks remain
local to the phone until explicitly deleted. Sign-in does not assign server
ownership to those walks; the authenticated completion contract is part of M3.

## Local gates before submitting

From the repository root:

```sh
npm test
npm run test:mobile
npm run typecheck --workspace @walquest/mobile
npm run lint --workspace @walquest/mobile
npm run build
```

From `apps/mobile`:

```sh
npx expo-doctor
npx expo export --platform all
npm run build:preflight
npx eas-cli@latest build:inspect --platform android --stage archive --profile development --output ../../.local/eas-m1-archive
```

Use a fresh output directory for archive inspection. It requires Expo login but
does not submit a build. Verify root manifests, `apps/mobile` and `packages/domain`
are included. `.easignore` excludes Git metadata, local notes, environment files,
native build caches, signing credentials and unrelated web source. The root
package still installs web dependencies because this is an npm workspace.

The build preflight reports missing local configuration and submits nothing.
Also verify the EAS development environment has the public settings, Android
signing is available, the Supabase redirect is allowed, and quota is available.

## First build note

Record the signed branch commit and this scope in issue #3 before submitting:

- Outcome: native map renders, session survives reopen, timestamped walk samples
  reach SQLite while the phone is locked.
- Native scope: Router/dev client, MapLibre, Location/TaskManager, SQLite,
  SecureStore and Crypto. No notification integration in this batch.
- Profile: `development`; platform: Android; device: Moto G45 5G / Android 15.
- Worker estimate: **15–30 minutes**, provisional and unmeasured.
- Queue: unknown; hours possible on Free. Track queue and worker time separately.
- Budget: **one planned M1 Android job**. Two unforeseen-build buffers stay reserved.

After the gates pass, submit once from `apps/mobile`:

```sh
npx eas-cli@latest build --platform android --profile development
```

Record the build ID/URL and quota consumed. Diagnose a failed build before retrying.
This development client uses Metro; start it from the root with
`npm run start --workspace @walquest/mobile` after installing the artifact.

## Physical acceptance

1. Cold-launch five times with Metro reachable; the native map renders each time.
2. Request/open the magic link on the Moto, confirm the account, then reopen and
   confirm the session persists. No tokens should appear in logs or diagnostics.
3. Explain and grant precise/background location. Start a 20-minute walk, with
   15 minutes locked. Record permission and battery settings with the result.
4. Reopen, inspect saved point count, timestamps, accuracy and location gaps.
   Export the recording only through the explicit Share control.
5. Pause/resume and finish. Missing intervals should be separate lines with no
   invented connecting distance. Saved points survive reopening.
6. Delete the saved walk and confirm its points disappear. Sign out and confirm
   the session is absent after another launch.

A force-stopped app is not expected to continue recording. Signing, native
linking, battery behavior and OS delivery cannot be proven by desktop tests.
Keep M1 open until the artifact and device evidence pass these checks.
