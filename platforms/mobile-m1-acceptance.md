# M1 device acceptance — resume record

## Current evidence

- Source baseline: mobile foundation commit `74adb425808d4f5b82960a251e64f94b52c38a0c`.
- Saved EAS job: `0da1688f-a82c-4e3e-afd0-a889bacafc78`, Android development profile, submitted 23 October 2026 (Asia/Calcutta).
- GitHub issue #3 comment dated 31 October records this build as FINISHED: queue 86.674 seconds and worker duration 19m21.765s. APK installation and the development launcher were reported; map and physical acceptance were still open. Current artifact availability and quota are unverified. Evidence: https://github.com/PrashantSinghal619/walquest/issues/3#issuecomment-6539814949
- Owner report received 10 November 2026: a 7-minute walk, including 3 minutes with the screen locked, recorded as expected. Sign-in persistence after reopening is unknown. Treat this as partial M1 evidence; it does not satisfy the 20-minute/15-minute-locked protocol. The phone will be available later.
- Existing statements that no build was submitted are historical and superseded by the saved job record. Do not assume the monthly quota or buffer balance from those statements.
- App display name, permission copy and recorder/account messages now use lowercase walquest. Display-name and native permission-text updates require a new binary; JavaScript messages can be tested with the existing compatible development client.

## Record before repeating device checks

Build ID / installed version:
Phone / OS:
Test date:
Permissions (precise and background location):
Battery restrictions:
Metro connection:
Earlier results and outstanding failures:

## M1 checks

Mark each pass/fail with the observation; leave untested items open.

- [ ] Five cold launches; map renders each time.
- [ ] Request the newest magic link in the app and open it on the same phone.
- [ ] Reopen the app; signed-in account is preserved.
- [ ] Record 20 minutes including 15 minutes with the screen locked.
- [ ] Reopen; saved timestamps cover the locked interval. Record sample count and gaps over 30 seconds.
- [ ] Pause and resume; missing movement is excluded from the line and distance.
- [ ] Finish and reopen; committed points remain available.
- [ ] Explicitly share diagnostics only to the intended destination; the export contains precise location.
- [ ] Delete the test walk; its saved points disappear.
- [ ] Sign out and reopen; the account session is absent.

Force-stop is not expected to continue recording. Local desktop tests cannot establish native background behavior. Keep M1 open until device evidence is complete.

## Next milestone

After M1 acceptance, test M2 permission denial/revocation, a 45-minute walk including 10 minutes offline, and force-close/relaunch recovery with an explicit missing interval. Keep territory submission disconnected until the completion backend is hardened for M3.

## Local validation — 10 November 2026

- 16 mobile recorder/auth tests passed.
- 72 existing web tests passed.
- Mobile typecheck and lint passed.
- Patch formatting check passed.
- No new EAS build submitted; no claim backend or web-demo changes made.
