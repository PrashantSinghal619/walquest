# Phone step counting with distance fallback

Requirement recorded: 12 November 2026. Scheduled: **M2 — native integration, recovery and permissions**. Status: planned; phone step counting is not implemented. M5 measures sustained reliability. This brief is the implementation-day handoff, not evidence of completed sensor integration.

## Required behavior

Prefer phone-counted steps when the device supports them, permission is granted and coverage is trustworthy for the relevant recording interval. Otherwise use the existing distance estimate. Recording must continue if motion/activity access is declined or unsupported; it must not require demographic information.

| Evidence for the walk | Display and calculation |
| --- | --- |
| Complete, trustworthy phone-counter coverage | `Steps`, with `Phone counter` as the source in Walk details. A genuine sensor zero is zero. |
| No usable phone-counter coverage, but recorded distance exists | `Estimated steps`, with an approximation mark; distance divided by the assumed 0.75m step length. |
| Partial sensor coverage with known, disjoint time intervals | `Estimated steps` for the combined total; measured counts plus distance estimates for uncovered intervals only. Explain the split in Walk details. |
| Partial coverage whose boundaries cannot be established | Use a whole-walk distance estimate; retain the partial sensor evidence for diagnosis but do not add it to the full-distance estimate. |
| Neither usable sensor evidence nor recorded distance for an interval | Mark that interval unmeasured. Do not fabricate steps or silently present a partial total as complete. |

Sensor coverage and GPS coverage are independent. A sensor can count steps during a GPS gap; those steps may contribute when their walk interval is established. The distance fallback cannot fill an unrecorded GPS gap. Pause intervals contribute neither sensor steps nor distance estimates. A missing sensor reading is not equivalent to a measured zero.

Round the combined estimate once for display. Preserve raw evidence, method and assumptions so reopening or later reconciliation does not silently change a counted result into an unexplained estimate. Do not claim that a phone counter is exact ground truth.

## Implementation-day sequence

1. Read the installed Expo major version and matching official docs again. Confirm M1 acceptance and inspect the existing development binary before adding modules.
2. Prove a platform adapter on the Moto G45 / Android 15 first. Verify hardware availability, activity permission, counter semantics, locked-screen delivery or historical recovery, and reboot/reset behavior. Check whether the current Android location foreground service can support the chosen implementation; do not assume it can host another native sensor task.
3. Evaluate Android native cumulative step-counter integration versus a compatible history source such as Health Connect. Availability, history granularity and walk-interval attribution are decision gates. Do not assume Health Connect is installed, populated, or suitable for exact pause boundaries. Document the selected adapter and its limitations before introducing its dependency.
4. For the deferred iOS target, evaluate permission and date-range recovery using the platform pedometer. Test interval boundaries and history-retention limits on a real phone before marking iOS supported.
5. Define one platform-neutral step-evidence interface and pure source-selection calculation. Implement interval coverage and reconciliation tests before connecting the UI.
6. Persist step evidence alongside the local walk, migrate existing recordings safely, and integrate start/pause/resume/finish/delete/reopen with the recorder's serialized command/store operations.
7. Update the existing metric and Walk details to distinguish counted, estimated, mixed and incomplete coverage. Verify permission-denied recovery and settings guidance without blocking local walks.
8. Run relevant tests, mobile types/lint, config checks and both platform bundle exports. Include required native dependencies and permissions in the planned M2 build note and quota accounting, not an automatic build per change.

## Platform constraints already established

Expo SDK 58's basic `Pedometer.watchStepCount` does not deliver updates while the app is in the background. It cannot alone satisfy walquest's locked-screen requirement. The docs point Android implementations toward Health Connect alternatives and provide date-range step queries on iOS. These are starting points to evaluate, not a promise that either supplies the required interval precision or survives every lifecycle event.

Recheck on implementation day:

- [Expo SDK 58 Pedometer](https://docs.expo.dev/versions/v58.0.0/sdk/pedometer/)
- [Android step-counter sensors](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion#sensors-motion-stepcounter)
- [Android Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect)
- [Apple CMPedometer](https://developer.apple.com/documentation/coremotion/cmpedometer)

Activity/motion permissions and their explanation are separate from location permissions. Ask only when enabling counting, preserve the fallback on refusal, and update privacy disclosures if a health-history source is selected. Force-stop is not assumed to permit continued recording or sensor delivery.

## Data and reconciliation rules

Persist walk/segment identity, active interval boundaries, source, counter baseline/checkpoints, sample timestamps, reset/boot identity where available, coverage boundaries, and the estimator version/assumed step length used. Choose the concrete schema with the adapter; do not store fabricated fine-grained timestamps for a coarse historical total.

- Derive per-walk deltas from the counter baseline; never display the device's since-boot or daily total as this walk's steps.
- Deduplicate repeated callbacks and history queries, including overlapping historical windows. Repeated reconciliation must produce the same total.
- On pause, close the active interval. On resume, establish a new baseline/interval so paused movement is excluded.
- Treat a decreasing/reset counter or unavailable baseline as a new evidence interval, not a negative delta or a huge jump.
- Recover checkpoints after restart. Fill only intervals actually supported by historical evidence; otherwise retain the fallback/incomplete label.
- Delayed sensor evidence may replace a fallback interval; it must not be added on top of it. Do not extrapolate partial sensor counts over the whole walk.
- Apply an explicit, versioned SQLite migration. Old walks with no step evidence retain their distance estimate. Deleting a walk removes its step evidence as well.
- Keep evidence local in M2. Server synchronization is an M3 contract decision; no new backend or health-data upload is implied here.

## Existing code entry points

| File | Work |
| --- | --- |
| `apps/mobile/src/recording/summary.ts` | Current distance/step estimate. Extend through one source-selection function; preserve segmented distance. |
| `apps/mobile/src/recording/store.ts`, `database.ts` | Durable evidence, migration, interval/checkpoint transactions and deletion. |
| `apps/mobile/src/recording/controller.ts`, `task.ts`, `use-recorder.ts` | Recorder lifecycle, native adapter coordination and foreground recovery. Keep native callbacks compatible with headless operation. |
| `packages/domain/src/recording.ts` | Versioned recording/evidence types if shared exports or diagnostics need them. |
| `apps/mobile/src/app/index.tsx`, `components/walk-screen.tsx` | Supply source-aware counts, honest labels and coverage explanation. Do not implement source arithmetic in the screen. |
| `apps/mobile/tests/recording.test.mjs` | Existing persistence, segmentation and fallback tests; add focused source/recovery cases. |
| `apps/mobile/app.json`, `package.json`, root lockfile | SDK-compatible module and permission changes after adapter selection. |

## Tests and acceptance

Automated tests must cover: unavailable/denied sensor; valid sensor zero; all-sensor and all-distance walks; partial/disjoint coverage; unknown boundaries; pause/resume; duplicate and overlapping queries; delayed replacement of estimates; reboot/reset; persistence failure and reopen; GPS gaps with and without sensor coverage; old-schema migration; and deletion. Assert no double-counting and idempotent reconciliation.

M2 physical acceptance on each enabled platform:

- [ ] Grant and deny motion/activity permission separately; the UI names the active source and walks still work with fallback.
- [ ] Compare phone-counted steps with a manually counted 200-step walk, phone carried in the normal walking position. Provisional target: within 10% (180–220). Record device, carry position and pace; investigate misses rather than relabelling an estimate as counted.
- [ ] Pause, walk 50 counted steps, resume and walk another counted interval. Paused steps must not enter the walk total.
- [ ] Include a substantial locked-screen interval in M2's 45-minute walk with 10 minutes offline. Recover available step evidence after reopening; preserve saved data and explain uncovered intervals.
- [ ] Relaunch/reconcile repeatedly; totals do not duplicate. Test counter resets/reboots separately when practical and retain incomplete coverage honestly.
- [ ] Disable/revoke sensor access mid-walk; fallback covers only eligible uncovered distance and the source label changes correctly.
- [ ] Finish/reopen and delete; steps restore consistently and are removed with their walk.

M5 repeats step comparisons during the 60-minute locked-walk reliability protocol, recording count error, coverage, carry position, GPS gaps and battery consumption. The 10% step tolerance is a provisional product acceptance target, not a claimed sensor specification or distance-estimate accuracy guarantee.

## Ready-to-use implementation summary

Implement M2 phone step counting with distance-estimate fallback. Select a device-tested Android adapter and prepare the deferred iOS adapter; foreground-only Expo callbacks are insufficient. Persist counter baselines and interval coverage, exclude pauses, reconcile historical/late evidence idempotently, and handle reset/restart without double-counting. Prefer counted steps only for trustworthy coverage; label distance-only or mixed totals as estimated and disclose missing intervals. Keep the 0.75m assumption explicit, migrate older walks, retain denial-safe recording, and validate locked-screen behavior plus the controlled-count protocol before declaring M2 complete.
