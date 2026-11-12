# Mobile UI alignment

The native map screen follows the authenticated web map, rather than the marketing landing page. It uses the web palette from `app/globals.css`, bundled Geist regular/medium/semibold fonts, a compact walquest header and walk controls beside the route. The OpenFreeMap Liberty map style is unchanged, including in dark mode, matching the web map.

## Screen organization

- The map receives the remaining screen height. Its attribution stays visible above the controls.
- Start, pause, resume and finish remain on the map screen. Finish still saves locally; it does not submit a territory claim.
- Account opens a dismissible full-screen sheet containing the existing magic-link sign-in and sign-out behavior.
- Walk details opens a separate sheet for raw point/segment counts, accuracy, sharing and deletion. The existing confirmations protect sharing and deletion.
- Light/dark appearance follows the system until changed using the header control. The manual choice lasts for the current app session.
- Auth restoration and the recorder remain mounted while sheets are open. Sheet changes do not navigate away from or stop the walk.

`WalkScreen` and `AccountView` contain presentation; the existing home and account controllers supply state and actions. SQLite, background task delivery, permission requests, session storage, and backend behavior are unchanged by the layout work.

## Estimated steps

The walk panel and Walk details show estimated steps derived from saved GPS distance divided by an assumed 0.75m step length, rounded to a whole step. This is a product default, not a measured personal step length or a demographic average. Route gaps and pauses remain excluded because the estimate uses the existing segmented distance. The number is recomputed from saved samples after reopening; no schema change or sensor permission is required. GPS drift can inflate it, and unrecorded movement is not counted. Phone step counting with source-aware fallback is required in M2; see [the implementation brief](./mobile-step-counting.md). Personal step-length calibration remains a separate future improvement.

## Fonts and runtime

`expo-font` 58.0.9 was already installed transitively in the M1 dependency tree; it is now declared directly. Fonts load at runtime without adding a native config plugin. Font loading does not block the recorder or app startup; system text is the fallback. The bundled Geist license is included alongside the font files.

## Validation

Local checks on 10 November 2026:

- 16 mobile recorder/auth tests pass; mobile typecheck and lint pass.
- Android and iOS Hermes bundles export successfully, including the fonts.
- A local browser harness renders the actual native presentation components through React Native Web. It uses a simulated route and account callbacks, a web MapLibre renderer, and zero safe-area insets. It does not call Supabase or native recording APIs.
- Browser smoke checks cover 390×844, 320×568 and 844×390 layouts, light/dark appearance, account and detail sheets, loaded fonts, and 44px minimum button targets. No horizontal overflow or JavaScript exceptions were observed.
- Visual inspection retained the existing parchment palette. The automated font-family count is waived because native font weights register as separate family names; they are all Geist. Development-server inspection checks presentation only.

The visual harness and screenshots live under ignored `.local/mobile-ui-preview/`. Native safe areas, keyboard avoidance, screen-reader behavior and font rendering need device confirmation. Browser previews do not establish those results. No cloud build or deployment was submitted for this change.

Device follow-up: connect the existing development client to Metro from this checkout, inspect the map and both sheets, start/pause/resume/finish a walk, and verify sign-in return and persistence. App-name and OS permission-copy changes from the earlier branding correction appear only in a subsequently rebuilt native binary.
