# Enlighted — Bugs & Caveats Workbook

**Project:** Ionic/Angular app for HTTP-based LED controller (ESP device)
**Stack:** Angular 22, Ionic 8, Capacitor 8, Angular Material, RxJS 7
**Last review pass:** 2026-07-16 (second pass). Gates: build ✓, test 17/17 ✓, lint 0 errors (45 warnings) ✓.

Only **open** findings and **verified non-issues** are listed. Fixed and
misdiagnosed entries (former sections 1–9, 10.1–10.5) were pruned on
2026-07-16 — see git history of this file for the full record. Finding numbers
are kept stable; `IMPROVEMENTS.md` references them. Design decisions and
non-bug suggestions live in `IMPROVEMENTS.md`.

---

## Table of Contents

1. [Open Findings — Review 2026-07-16](#open-findings--review-2026-07-16) (10.6–10.14)
2. [Open Findings — Second Review 2026-07-16](#open-findings--second-review-2026-07-16) (12.1–12.7)
3. [Verified Non-Issues](#verified-non-issues)
4. [Summary Table](#summary-table)

---

## Open Findings — Review 2026-07-16

### 10.6 Sunrise save: stale "unsaved changes" flag when the poll never matches ⚠️ Open

**File:** [sunrise.component.ts:85-123](src/app/sunrise/sunrise.component.ts#L85-L123)

- If none of the 6 post-save polls matches (device normalises values, or the
  readback stays stale), `savedSunriseJson` is never refreshed — the next
  pull-to-refresh incorrectly warns about "unsaved changes" even though the
  user just saved. The `JSON.stringify` comparison is also key-order sensitive:
  if the firmware serialises keys in a different order, the poll can *never*
  match.
- `if (!this.deviceSettings && lastRes)` ([sunrise.component.ts:111](src/app/sunrise/sunrise.component.ts#L111))
  is dead code: `deviceSettings` was already non-null (`this.deviceSettings!` above).

---

### 10.7 `onAddressChanged`: untrimmed address stored, broken dedup, floating promises ⚠️ Open

**File:** [settings-view.component.ts:233-296](src/app/settings-view/settings-view.component.ts#L233-L296)

- Validation runs on the **trimmed** address, but the stored device uses the raw
  `event.target.value` ([line 242](src/app/settings-view/settings-view.component.ts#L242)).
  An address with a trailing space passes validation yet produces broken URLs
  (`http://192.168.1.5 /api/...`). Use `deviceAddress` consistently.
- `newSettings.KnownDevices.indexOf(newDevice, 0)` ([line 274](src/app/settings-view/settings-view.component.ts#L274))
  compares object references against a freshly created object — always `-1`, so the
  guard is useless and the push always happens. Since only same-*address* entries were
  removed, a same-*name* device with a different address survives → duplicate names, and
  `findDevice` (first match by name) can then select the stale entry.
- `this.localStorage.writeSettings(newSettings)` is a floating promise (not awaited)
  in both branches ([line 260](src/app/settings-view/settings-view.component.ts#L260),
  [line 282](src/app/settings-view/settings-view.component.ts#L282)).

---

### 10.8 `getLedStatus` has no timeout ⚠️ Open

**File:** [ledcontrol.service.ts:93-100](src/app/services/ledcontrol.service.ts#L93-L100)

Every other request has a `timeout(1000–3000)`, but `getLedStatus` has none. Against an
unreachable device that accepts the TCP connection but never answers, `onRefresh` in
led-detail awaits it indefinitely and the pull-to-refresh spinner never completes.
(Config writes have the same gap — see 12.3.)

---

### 10.9 `applyDeviceSettings` and `saveDeviceSettings` are identical duplicates ⚠️ Open

**File:** [ledcontrol.service.ts:152-178](src/app/services/ledcontrol.service.ts#L152-L178)

Both methods PUT the same payload to the same `/api/config` URL with the same headers and
error label. The comment `// no restart of controller` implies an intended difference
that doesn't exist. Keep one.

---

### 10.10 Copy-paste log labels ⚠️ Open

**File:** [ledcontrol.service.ts:104](src/app/services/ledcontrol.service.ts#L104), [ledcontrol.service.ts:148](src/app/services/ledcontrol.service.ts#L148)

`saveStatus` logs `'get led status from:'` and `getTime`'s `tap` logs
`'fetched device settings'`.

---

### 10.11 `ion-title` inside `ion-item` in settings-view & sunrise ⚠️ Open

**Files:** [settings-view.component.html:8](src/app/settings-view/settings-view.component.html#L8), [settings-view.component.html:35](src/app/settings-view/settings-view.component.html#L35), [settings-view.component.html:49](src/app/settings-view/settings-view.component.html#L49), [sunrise.component.html:8](src/app/sunrise/sunrise.component.html#L8), [sunrise.component.html:21](src/app/sunrise/sunrise.component.html#L21)

`<ion-title>` is intended for `<ion-toolbar>`, but is still used as a list label in
the settings view ("Address", "Known Devices", "Device Settings") and sunrise
("Device Name", "Time"). Replace with `<ion-label>` as was done for led-detail.

---

### 10.12 `ion-refresher` not a direct child of `ion-content` in settings/sunrise ⚠️ Open

**Files:** [settings-view.component.html:2](src/app/settings-view/settings-view.component.html#L2), [sunrise.component.html:2](src/app/sunrise/sunrise.component.html#L2)

These components render into a plain `<div>` but keep their own
`<ion-refresher slot="fixed">` inside that div. Slot projection only applies to direct
children of `ion-content`, so `slot="fixed"` is ineffective and the refresher's
positioning is unreliable. Tab1 does it correctly: the refresher lives in
[tab1.page.html](src/app/tab1/tab1.page.html) and delegates via a template ref. Move the
refreshers up into tab2/tab3 pages the same way.

---

### 10.13 build-apk.sh always copies the *debug* APK to a personal share ⚠️ Open

**File:** [build-apk.sh:38](build-apk.sh#L38)

```bash
cp /home/schusti/workspace/enlighted/android/app/build/outputs/apk/debug/* /home/schusti/NextcloudFrick/Shared/
```

Inside the success branch this unconditionally copies the **debug** output directory —
even for `./build-apk.sh release` (where it ships a stale debug APK, or errors under
`set -e` if no debug build exists). It also hardcodes an absolute personal Nextcloud
path into a repo script. Use `"$APK_DIR"`/`"$APK"` and make the copy destination an
opt-in environment variable.

---

### 10.14 Minor / cosmetic ⚠️ Open

- **`compareDevice` ternary has identical branches** —
  [settings-view.component.ts:101-103](src/app/settings-view/settings-view.component.ts#L101-L103):
  `o1.Name && o2.Name ? o1.Name === o2.Name : o1.Name === o2.Name`.
- **Native `confirm()` in sunrise unsaved-changes guard** —
  [sunrise.component.ts:62](src/app/sunrise/sunrise.component.ts#L62): works, but is
  unstyled and blocking; use an `ion-alert` like the Reset-WiFi flow.
- **Seven copy-pasted day blocks in the sunrise template** —
  [sunrise.component.html:52-195](src/app/sunrise/sunrise.component.html#L52-L195):
  should be an `*ngFor` over the weekdays. Also inconsistent: Fri/Sat/Sun rows have an
  empty `<ion-label></ion-label>` that Mon–Thu lack, so the rows align differently.
- **Inconsistent null-guarding in led-detail template** —
  [led-detail.component.html:14](src/app/led-detail/led-detail.component.html#L14) uses
  `deviceSettings()?.SunriseSettings?.IsActivated` while
  [line 32](src/app/led-detail/led-detail.component.html#L32) uses
  `deviceSettings()!.SunriseSettings.IsActivated` (non-null assertion) — throws at
  runtime if firmware ever omits `SunriseSettings`.
- **Reset-WiFi alert text hardcodes the SSID/password** —
  [settings-view.component.html:62](src/app/settings-view/settings-view.component.html#L62)
  duplicates the values of `DEFAULT_WIFI_SSID`/`DEFAULT_WIFI_PASSWORD` as prose; they can
  drift apart.
- **`zone-flags.ts` is dead** — [src/zone-flags.ts](src/zone-flags.ts) is imported
  nowhere (the app is zoneless) and carries a lint warning. Delete it.
- **Tests run with zone.js, app runs zoneless** — the test target's polyfills
  ([angular.json](angular.json)) load `zone.js`, while the app bundle doesn't.
  Change-detection timing in tests does not reflect production; keep in mind when a CD
  bug "doesn't reproduce" in a spec.

---

## Open Findings — Second Review 2026-07-16

Second review pass over the current tree, same day. Gates at time of review:
`npm run build` ✓, `npm test` 17/17 ✓, `npm run lint` 0 errors / 45 warnings ✓.

### 12.1 Firmware-version probe race — stale probe can flip the write encoding for the wrong device ⚠️ Open

**File:** [ledcontrol.service.ts:51-91](src/app/services/ledcontrol.service.ts#L51-L91)

`setDevice()` fires `probeFirmwareVersion()` on every call and the probe's `.then`
unconditionally writes `this.firmwareVersion` / `this.useRawJson` when it resolves.
Nothing checks whether the probe still belongs to the *current* device.

**Failure scenario:** switch from device A (new firmware, slow to answer) to
device B (old firmware, fast). Probe B resolves first (`useRawJson = false`),
then probe A resolves late and sets `useRawJson = true`. All subsequent writes to
**B** are sent as raw JSON — which B's old firmware silently drops while returning
200 OK (see the write-encoding entry under Verified Non-Issues). The settings page
can also display A's firmware version for B. `setDevice` is called from many places
in quick succession (three tab `ngOnInit`s, `writeSettings`, `handleRefresh`,
`onAddressChanged`), so overlapping probes are routine, not exotic.

**Fix:** capture the target device (or the promise identity) when the probe starts
and apply the result only if it is still current, e.g.
`if (this.versionProbe !== myProbe) return '';` — or re-probe lazily per request.

---

### 12.2 Cached sunrise tab can write device A's full config to device B ⚠️ Open

**Files:** [sunrise.component.ts:60-64](src/app/sunrise/sunrise.component.ts#L60-L64), [sunrise.component.ts:85-90](src/app/sunrise/sunrise.component.ts#L85-L90), [tab2.page.ts:18-24](src/app/tab2/tab2.page.ts#L18-L24)

The sunrise component holds the **entire** `DeviceSettings` of the device it last
refreshed from, and `clickedSave()` PUTs that whole object to whatever
`ledcontrolService.currentDevice` points at *now*.

**Failure scenario:** edit an alarm time on device A → switch to the Settings tab
and select device B → return to the Sunrise tab. `ionViewWillEnter` triggers
`clickedRefresh()`, which detects unsaved changes and pops the `confirm()` dialog.
Choose *Cancel* (protecting your edits — the natural choice). The component still
displays A's data, the save button is enabled, and the service targets B. Tapping
save now writes **A's complete config — SensorID, WiFi credentials, pin
assignments, LED count — onto device B**, effectively cloning A over B.

Related UX wart: the blocking native `confirm()` fires *during* the tab
transition (see also 10.14's `confirm()` note).

**Fix:** track which device the loaded settings belong to and discard/refuse the
save when it no longer matches the current device (or force a refresh on device
change instead of asking).

---

### 12.3 Config writes have no timeout — a hung PUT permanently hides the save/restart buttons ⚠️ Open

**File:** [ledcontrol.service.ts:152-159](src/app/services/ledcontrol.service.ts#L152-L159), [ledcontrol.service.ts:171-178](src/app/services/ledcontrol.service.ts#L171-L178)

Same class as 10.8, but worse fallout: `applyDeviceSettings` and
`saveDeviceSettings` have **no** `timeout()` operator. `clickedApplyDeviceConfig`
(settings) and `clickedSave` (sunrise) set `enableSave = false`, then `await` the
PUT. Against a device that accepts the TCP connection but never answers, the await
never resolves and `enableSave` stays `false` forever. Both templates gate the
save/restart icons with `*ngIf="enableSave"`, so the buttons **vanish permanently**
until the tab is destroyed. Add `timeout(3000)` like `saveStatus` has, and prefer
`[disabled]` over `*ngIf` so a stuck state is at least visible.

---

### 12.4 Corrupt persisted settings crash every tab at startup; missing shape validation ⚠️ Open

**File:** [localstorage.service.ts:24-43](src/app/services/localstorage.service.ts#L24-L43)

`readSettings()` runs `JSON.parse(value)` with no try/catch. One corrupt
`Preferences` blob (interrupted write, manual tampering, future schema change) and
`readSettings` throws in the `ngOnInit` of **all three tabs on every launch** — the
app is bricked until its storage is cleared. Additionally, only `KnownDevices` is
null-checked after parsing; a stored object without `CurrentDevice` flows into
`setDevice(undefined)` and every request goes to `http://undefined/api/...`.

**Fix:** wrap the parse in try/catch, fall back to the defaults (and overwrite the
corrupt blob), and validate `CurrentDevice` the same way `KnownDevices` already is.

---

### 12.5 Removing the current device leaves the removed device's config on screen ⚠️ Open

**File:** [settings-view.component.ts:320-333](src/app/settings-view/settings-view.component.ts#L320-L333)

`removeKnownDevice()` re-targets `CurrentDevice` to the first remaining device and
persists (which also calls `setDevice`), but never refreshes `deviceConfig` /
`firmwareVersion`. The form keeps showing the **removed** device's settings and
firmware version; tapping save would write them to the newly selected device
(small-scale variant of 12.2). Call `clickedRefreshDevice()` after the switch.

---

### 12.6 LED tab hides all controls when the config fetch fails, even though the LED endpoint works ⚠️ Open

**Files:** [led-detail.component.html:48](src/app/led-detail/led-detail.component.html#L48), [led-detail.component.ts:173-184](src/app/led-detail/led-detail.component.ts#L173-L184)

`onRefresh()` returns early when `getDeviceSettings()` fails, and the template
gates the sliders, buttons 1/2, and level config on
`*ngIf="deviceSettings()?.SunriseSettings"`. A device whose `/api/config` is slow
or failing (but whose `/api/led` works fine) renders only the power and
color-randomizer buttons with no error hint. Consider gating only the
sunrise-warning banner on `SunriseSettings` and showing the LED controls whenever
`ledStatus` is available — or at least surfacing "config unavailable".

---

### 12.7 Minor / cosmetic (second pass) ⚠️ Open

- **Validation failures give no user feedback** —
  [settings-view.component.ts:137-146](src/app/settings-view/settings-view.component.ts#L137-L146):
  an invalid `ServerAddress`/`Button2GetURL` aborts the save with only a
  `console.error`; the save button just silently "does nothing". Show a toast
  (the service already has `presentToast`).
- **Triple version probe at startup** — all three tabs call
  `setDevice(settings.CurrentDevice)` in `ngOnInit`, firing three identical
  `/api/version` probes (plus re-probes on every pull-to-refresh via
  `handleRefresh` → `setDevice`). Harmless but chatty; probe once per address.
- **`firmwareDate` is computed but never used** —
  [ledcontrol.service.ts:42](src/app/services/ledcontrol.service.ts#L42) (the
  field even says so). Delete it or use it (e.g. "firmware older than X" hint).
- **`npm test` fails out-of-the-box on headless machines** —
  [karma.conf.js:40](karma.conf.js#L40) defaults to `browsers: ['Chrome']`; the
  `ChromeHeadlessNoSandbox` launcher exists but must be selected manually
  (`npm test -- --browsers=ChromeHeadlessNoSandbox`). Wire it into the `ci`
  configuration in [angular.json](angular.json).
- **`zone.js` is a production dependency of a zoneless app** —
  [package.json](package.json): only the karma polyfills use it; move it to
  `devDependencies`.
- **`src/test.ts` is referenced only by `tsconfig.spec.json`** — the
  `@angular/build:karma` builder discovers specs itself; the file (and the
  include entry) look vestigial. Same cleanup bucket as the dead
  `zone-flags.ts` (10.14).

---

## Verified Non-Issues

Things that look like bugs at first glance but were verified — recorded here to
save future review passes the trouble:

- **`Content-Type: application/x-www-form-urlencoded` on JSON writes to old
  firmware** is required and must not be "corrected". Old firmware
  (ESPAsyncWebServer) only exposes a request body as a POST param when the
  Content-Type is form-urlencoded; the whole JSON body then arrives as the value
  of a single implicit `body` param — exactly what the firmware reads. With
  `application/json` the body is dropped, `configman::writeConfig("")` fails
  silently, and the device still returns **200 OK**. A 2026-07-16 "fix" broke all
  device writes and was reverted the same day. New firmware is detected via
  `GET /api/version` and then gets proper `application/json`. See the warning
  comment on `legacyOptions` in [ledcontrol.service.ts](src/app/services/ledcontrol.service.ts)
  and `IMPROVEMENTS.md` §1.2; verified against
  [esp-enlightened](https://github.com/pat-rohn/esp-enlightened) `src/webpage.cpp`.
- **`ChangeDetectionStrategy.Eager`** is real in Angular 22: the enum is now
  `OnPush = 0` (the default) and `Eager = 1` (the old `Default`). The components
  explicitly opt out of the new OnPush default — valid, though led-detail is fully
  signal-based and could likely drop the override.
- **`withXhr()`** exists in `@angular/common/http` v22 (fetch became the default backend;
  XHR is opt-in). XHR is deliberate here so the `CapacitorHttp` plugin can patch it for
  native requests.
- **`settings: Settings = this.localStorage.settings` field initializer**
  ([settings-view.component.ts:19](src/app/settings-view/settings-view.component.ts#L19))
  referencing a constructor parameter property is safe with this tsconfig
  (`useDefineForClassFields: false` — parameter properties are assigned before field
  initializers). Verified with a compiled repro.
- **Cleartext HTTP on Android** is correctly configured: `android:usesCleartextTraffic="true"`
  in the manifest plus `server.androidScheme: 'http'` in
  [capacitor.config.ts](capacitor.config.ts), so plain-HTTP device traffic works in the APK.

---

## Summary Table

| # | Severity | Area | Short Description | Status |
|---|----------|------|-------------------|--------|
| 10.6 | Medium | Alarm | Sunrise save: poll mismatch leaves stale "unsaved changes" flag | ⚠️ Open |
| 10.7 | Medium | Component | Untrimmed address stored; broken device dedup; floating promises | ⚠️ Open |
| 10.8 | Low | Service | `getLedStatus` has no timeout — refresher can hang forever | ⚠️ Open |
| 10.9 | Low | Service | `applyDeviceSettings` / `saveDeviceSettings` are identical duplicates | ⚠️ Open |
| 10.10 | Low | Code | Copy-paste log labels in `saveStatus` / `getTime` | ⚠️ Open |
| 10.11 | Low | Template | `ion-title` inside `ion-item` in settings-view & sunrise | ⚠️ Open |
| 10.12 | Low | Template | `ion-refresher` not a direct child of `ion-content` — `slot="fixed"` ineffective | ⚠️ Open |
| 10.13 | Low | Tooling | build-apk.sh always copies debug APK to hardcoded personal share | ⚠️ Open |
| 10.14 | Low | Various | Minor: dead `zone-flags.ts`, `confirm()`, day-block duplication, etc. | ⚠️ Open |
| 12.1 | **Medium** | Service | Version-probe race — stale probe flips write encoding for the wrong device | ⚠️ Open |
| 12.2 | **Medium** | Alarm | Cached sunrise tab can write device A's full config onto device B | ⚠️ Open |
| 12.3 | Medium | Service | Config PUTs have no timeout — hung write hides save/restart buttons forever | ⚠️ Open |
| 12.4 | Medium | Service | Unguarded `JSON.parse` in `readSettings` — corrupt blob bricks the app | ⚠️ Open |
| 12.5 | Low | Component | Removing the current device leaves its config/firmware on screen | ⚠️ Open |
| 12.6 | Low | Template | LED controls hidden whenever config fetch fails, even if `/api/led` works | ⚠️ Open |
| 12.7 | Low | Various | Minor: silent validation failures, triple probe, karma default browser, etc. | ⚠️ Open |
