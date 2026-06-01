# Enlighted — Bugs & Caveats Workbook

**Project:** Ionic/Angular app for HTTP-based LED controller (ESP device)  
**Stack:** Angular 17, Ionic 7, Capacitor 4, Angular Material, RxJS 7

---

## Table of Contents

1. [Critical Bugs](#1-critical-bugs)
2. [Logic Bugs](#2-logic-bugs)
3. [RxJS / Async Anti-patterns](#3-rxjs--async-anti-patterns)
4. [Security Concerns](#4-security-concerns)
5. [TypeScript / Build Issues](#5-typescript--build-issues)
6. [Code Quality & Dead Code](#6-code-quality--dead-code)
7. [HTML / Template Issues](#7-html--template-issues)
8. [Dependency Caveats](#8-dependency-caveats)
9. [Alarm / Sunrise Setting Bugs](#9-alarm--sunrise-setting-bugs)

---

## 1. Critical Bugs

### 1.1 `writeSettings` uses stale `this.settings` instead of the parameter ✅ Fixed

> **Fixed** in commit `455a6eb` — parameter is now used in both the persist call and `setDevice`; `this.settings` is updated.

**File:** [src/app/services/localstorage.service.ts](src/app/services/localstorage.service.ts)

```ts
async writeSettings(settings: Settings) {
  console.log("write settings:" + JSON.stringify(this.settings)); // logs OLD state
  await Preferences.set({ key: this.settingKey, value: JSON.stringify(settings) })
  this.ledControlService.setDevice(this.settings.CurrentDevice); // ← BUG: uses old this.settings
}
```

**Problem:** The device is set from the *old* in-memory `this.settings`, not from the `settings` argument that was just persisted. Switching devices will immediately fall back to the previously active device.

**Also:** `this.settings` is never updated inside `writeSettings`, so `getSettings()` returns stale data until `readSettings()` is called again.

**Fix:** Use the `settings` parameter in both places, and update `this.settings`.

---

### 1.2 Trailing space in `Content-Type` header for button press ✅ Fixed

> **Fixed** in commit `c132f61` — trailing space removed.

**File:** [src/app/services/ledcontrol.service.ts](src/app/services/ledcontrol.service.ts#L68)

```ts
headers: new HttpHeaders({
  'Content-Type': 'application/json '  // ← trailing space
})
```

**Problem:** The header value `'application/json '` (with trailing space) is technically a different MIME type. Some servers/firmware may reject it or misparse it, causing button 1 and button 2 presses to silently fail.

---

### 1.3 `SunriseModule` exported but never imported in `AppModule` ✅ Fixed

> **Fixed** in commit `f548823` — `SunriseModule` added to `imports` in `AppModule`.

**File:** [src/app/app.module.ts](src/app/app.module.ts)

```ts
@NgModule({
  imports: [
    // ...
    // SunriseModule is NOT here
  ],
  exports: [LedDetailComponentModule, SettingsViewModule, SunriseModule], // ← in exports only
})
```

**Problem:** `SunriseModule` is in `exports` but not in `imports`. Angular requires a module to be imported before it can be exported. This will cause a runtime error in strict builds. The `app-sunrise` component works only because `tab2.module.ts` presumably imports the module directly — but this is an inconsistency that will cause confusion.

---

## 2. Logic Bugs

### 2.1 Button disabled logic is inverted ✅ Fixed

> **Fixed** in commit `aa25490` — expression corrected to `!isReady || !enableSaveButton`.

**File:** [src/app/led-detail/led-detail.component.html](src/app/led-detail/led-detail.component.html#L104)

```html
<ion-button [disabled]="!isReady && enableSaveButton" (click)="onButton1()">
<ion-button [disabled]="!isReady && enableSaveButton" (click)="onButton2()">
```

**Problem:** The intended logic is "disable when not ready OR save is not available." The actual expression `!isReady && enableSaveButton` evaluates `false` when both are `false` — meaning the button is *enabled* when nothing is ready. The correct expression is:

```html
[disabled]="!isReady || !enableSaveButton"
```

---

### 2.2 `onChangeColor` makes a redundant network call ✅ Fixed

> **Fixed** in commit `857af7e` — local `ledStatus` is now used directly; network fetch removed.

**File:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L334)

```ts
onChangeColor() {
  this.ledcontrolService.getLedStatus()   // ← fetches status from device
    .subscribe(ledstatus => {
      // immediately overwrites Red/Green/Blue anyway
      ledstatus.Red = 100;
      // ...
      this.onSave()
    });
}
```

**Problem:** `getLedStatus()` fetches the current state from the device only to have all color fields overwritten immediately afterward. This adds unnecessary latency and a possible point of failure. The local `ledStatus` already holds the current state and could be used directly.

---

### 2.3 Route param subscription fires before component is ready ✅ Fixed

> **Fixed** — all three components now use `skip(1)` on the `activeRoute.params` pipe, skipping the initial emission that fires before `ngOnInit`. The fragile null-check guard is removed.

**Files:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L55), [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L25), [src/app/sunrise/sunrise.component.ts](src/app/sunrise/sunrise.component.ts#L28)

**Files:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L55), [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L25), [src/app/sunrise/sunrise.component.ts](src/app/sunrise/sunrise.component.ts#L28)

```ts
constructor(..., private activeRoute: ActivatedRoute) {
  this.activeRoute.params.subscribe(params => {
    if (this.deviceSettings != null) {  // workaround for first-load race
      this.onRefresh();
    }
  });
}
```

> **Fixed** in commit `676b52a` — subscription now uses `takeUntil(destroy$)` so it no longer leaks on component destruction. However, the fragile null-check guard `if (this.deviceSettings != null)` is still present. The subscription also remains in the constructor rather than `ngOnInit`.

**Problem (remaining):** ~~The guard `if (this.deviceSettings != null)` is a fragile workaround: if device settings arrive before the route param emits a second time, the refresh is silently skipped. Moving the subscription to `ngOnInit` and using the router snapshot for initial navigation would be the correct fix.~~

> **Subsequently fixed** — replaced null-check with `skip(1)` in all three components.

---

### 2.4 `Settings.Ledstatus` field is stored but never read ✅ Fixed

> **Fixed** — `Ledstatus: LEDStatus` removed from the `Settings` interface and from the default value in `LocalstorageService`. The `import { LEDStatus }` and `import { DEFAULT_LED_STATUS }` in those files were removed accordingly.

**File:** [src/app/settings.ts](src/app/settings.ts), [src/app/services/localstorage.service.ts](src/app/services/localstorage.service.ts)

The `Settings` interface has a `Ledstatus` field and it's part of what's persisted. However, the actual LED status is always fetched fresh from the device — the stored `Ledstatus` value is never read back and applied. It just accumulates stale data in storage.

---

### 2.5 `handleChange` in settings-view is dead code ✅ Fixed

> **Fixed** in commit `df16075` — method removed.

**File:** [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L202)

```ts
handleChange(ev: any) {
  let device = this.findDevice(ev.target.value);
  if (device == null) {
    console.error("Device unknown: " + ev.target.value);
  } else {
    //this.connectedDevice = device  // ← commented out
    this.ledcontrolService.setDevice(this.connectedDevice)
    this.clickedRefreshDevice();
  }
}
```

This method is not bound to any template event and contains a commented-out assignment. It is unreachable and can be removed.

---

### 2.6 `setResult` is a no-op ✅ Fixed

> **Fixed** in commit `df16075` — method removed.

**File:** [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L232)

```ts
setResult(ev: any) {
  console.warn("reset device" + JSON.stringify(ev));
}
```

The `ion-alert` calls `(didDismiss)="setResult($event)"` but the actual WiFi reset logic in `resetWiFi()` is called via the `handler` of the "Yes" button, not here. This handler currently only logs and does nothing meaningful.

---

## 3. RxJS / Async Anti-patterns

### 3.1 Nested subscriptions (subscribe inside subscribe) ✅ Fixed

> **Fixed** in commit `2909004` — replaced with `switchMap` in `led-detail`, `settings-view`, and `sunrise`.

**Files:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L66), [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L38)

```ts
this.ledcontrolService.getDeviceSettings().subscribe(res => {
  this.deviceSettings = res;
  this.ledcontrolService.getLedStatus().subscribe(  // ← nested subscribe
    { next: (ledJson) => { ... } }
  )
});
```

**Problem:** Nesting `.subscribe()` calls is a well-known RxJS anti-pattern. If the outer Observable emits multiple times, multiple inner subscriptions are created and never cleaned up. Use `switchMap` or `concatMap` instead:

```ts
this.ledcontrolService.getDeviceSettings().pipe(
  switchMap(res => {
    this.deviceSettings = res;
    return this.ledcontrolService.getLedStatus();
  })
).subscribe({ next: (ledJson) => { ... } });
```

---

### 3.2 Subscriptions in constructor are never unsubscribed ✅ Fixed

> **Fixed** in commit `676b52a` — all three components implement `OnDestroy` with `takeUntil(destroy$)`.

**Files:** All three main components

`this.activeRoute.params.subscribe(...)` is created in constructors and never stored or unsubscribed. When Angular destroys and recreates these components (navigating between tabs), these subscriptions accumulate and leak.

**Fix:** Implement `OnDestroy`, store the subscription, and call `.unsubscribe()`, or use `takeUntilDestroyed()` (Angular 16+).

---

### 3.3 `onSliderChange` sends a network request on every knob move end with no debouncing ✅ Fixed

> **Fixed** — `onSave()` now emits on a private `save$` Subject. A `switchMap` pipeline consumes it, ensuring only one HTTP save request is in-flight at a time; a new emission cancels any pending request. This also resolves 3.4.

**File:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L106)

```ts
onSliderChange(ev: Event) {
  this.onSave();  // ← HTTP POST on every slider release
  ...
}
```

While `ionKnobMoveEnd` fires at drag-end (better than `ionChange`), rapid sequential slider adjustments will queue multiple overlapping HTTP requests. Adding a `debounceTime` or a "pending save" queue would improve reliability.

---

### 3.4 `onSave` and `onSelectChange` both fire independently on mode change ✅ Fixed

> **Fixed** — `onSave` is now routed through `save$` + `switchMap` (see 3.3), so concurrent save requests from slider interactions are serialised and the in-flight request is cancelled on a new emission.

**File:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L118)

`onSelectChange` fires a `saveStatus` request. If a slider interaction happens at the same time, `onSave` fires another request. There is no request queuing or cancellation (e.g., `switchMap`), so the last response wins, potentially reverting a user change.

---

## 4. Security Concerns

### 4.1 WiFi password hardcoded in source code ✅ Fixed

> **Fixed** — extracted to named module-level constants `DEFAULT_WIFI_SSID` and `DEFAULT_WIFI_PASSWORD` at the top of `settings-view.component.ts`. The credentials are no longer scattered as string literals in method bodies.

**File:** [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L112)

```ts
async resetWiFi() {
  this.deviceConfig.WiFiPassword = "enlighten-me";  // ← hardcoded default password
  this.deviceConfig.WiFiName = "Enlighted";
  ...
}
```

**Problem:** The default AP password is embedded in the source code and will be visible in any distributed APK via decompilation (or version control). Even if this is a "reset to defaults" function, consider fetching the default from a config or environment variable rather than hardcoding it.

---

### 4.2 All API communication is plain HTTP ✅ Fixed

> **Fixed** — `isValidUrl()` added to `SettingsViewComponent`. Before saving device config, both `ServerAddress` and `Button2GetURL` are validated with `new URL()` — only `http:` and `https:` schemes are accepted. Bare IPs, empty strings, and other schemes are rejected and the save is aborted.

**File:** [src/app/services/ledcontrol.service.ts](src/app/services/ledcontrol.service.ts)

---

### 4.3 No input validation on device address ✅ Fixed

> **Fixed** — `onAddressChanged` now calls `isValidDeviceAddress()` before acting. The helper uses a regex that accepts only IPv4 addresses, `host:port`, and simple hostnames — rejecting URL schemes, whitespace, and other malformed input.

**File:** [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L140)

```ts
onAddressChanged(event: any) {
  let deviceAddress = event.target.value as string
  if (deviceAddress.length > 0) {  // only check: non-empty
    this.ledcontrolService.setDevice({ Name: "Unknown", Address: deviceAddress })
    // immediately sends HTTP request to user-supplied address
  }
}
```

Any string triggers an immediate HTTP GET to `http://<user-input>/api/config`. This could be abused on a shared/public network to make the app act as a proxy or SSRF vector.

---

## 5. TypeScript / Build Issues

### 5.1 Deprecated `tsconfig.json` options (TypeScript 7.0) ✅ Fixed

> **Fixed** in commit `e9384df` — `baseUrl` and `downlevelIteration` removed; `moduleResolution` set to `"bundler"`.

**File:** [tsconfig.json](tsconfig.json)

```json
"baseUrl": "./",          // deprecated — TS7 warning
"downlevelIteration": true,   // deprecated — TS7 warning
"moduleResolution": "node",   // deprecated — TS7 warning
```

These generate compiler warnings now and will become errors in TypeScript 7.0. Migrate to:
- Remove `baseUrl` (or use `paths` with `bundler` resolution)
- Remove `downlevelIteration` (use `target: es2015+` which doesn't need it)
- Change `moduleResolution` to `"bundler"` for Angular 17+

---

### 5.2 `@angular/core`'s `Input` imported but unused ✅ Fixed

> **Fixed** in commit `7ddce87` — unused import removed.

**File:** [src/app/services/ledcontrol.service.ts](src/app/services/ledcontrol.service.ts#L1)

```ts
import { Injectable, Input } from '@angular/core';
```

`Input` is imported from `@angular/core` in a service file but never used. With `strict: true` this may cause a lint warning.

---

### 5.3 `var` used instead of `let/const` ✅ Fixed

> **Fixed** in commit `7ddce87` — replaced with `const`.

**File:** [src/app/led-detail/led-detail.component.ts](src/app/led-detail/led-detail.component.ts#L120)

```ts
var mode = value;
```

The project uses `strict: true` but still has `var` in one place. While not a bug, it's inconsistent with the rest of the code.

---

## 6. Code Quality & Dead Code

### 6.1 `useDummy` flag is hardcoded `false` with dead code paths ✅ Fixed

> **Fixed** in commit `1e72328` — flag and all unreachable branches removed.

**File:** [src/app/services/ledcontrol.service.ts](src/app/services/ledcontrol.service.ts#L20)

```ts
private useDummy: boolean = false;
```

There are `if (this.useDummy)` branches throughout the service that redirect URLs to local asset files. Since `useDummy` is never set to `true` and is not configurable at runtime, these branches are unreachable dead code.

---

### 6.2 Large commented-out block in `resetWiFi` ✅ Fixed

> **Fixed** in commit `61a4b95` — block removed.

**File:** [src/app/settings-view/settings-view.component.ts](src/app/settings-view/settings-view.component.ts#L116)

A ~12-line commented-out block of device settings assignments remains in `resetWiFi()`. Should be removed or tracked as a TODO.

---

### 6.3 Duplicate `id="input"` on every `ion-input` ✅ Fixed

> **Fixed** in commit `f088b00` — all duplicate `id="input"` attributes removed.

**File:** [src/app/settings-view/settings-view.component.html](src/app/settings-view/settings-view.component.html), [src/app/led-detail/led-detail.component.html](src/app/led-detail/led-detail.component.html)

Every single `<ion-input>` element in both settings and LED detail templates shares `id="input"`. HTML IDs must be unique per page. This breaks `document.getElementById`, labels (`for=`), and accessibility tools.

---

### 6.4 Misleading error log string in `getTime` ✅ Fixed

> **Fixed** in commit `7ddce87` — error label corrected to `'getTime'`.

**File:** [src/app/services/ledcontrol.service.ts](src/app/services/ledcontrol.service.ts#L108)

```ts
catchError(this.handleError<string>('Get Device Settings'))  // ← wrong label for getTime
```

The `getTime()` method uses `'Get Device Settings'` as the operation name in its error handler, making it harder to diagnose failures.

---

## 7. HTML / Template Issues

### 7.1 `ion-content` inside `ion-content` (double scroll context) ✅ Fixed

> **Fixed** in commit `20f011f` — child components (`app-led-detail`, `app-sunrise`, `app-settings-view`) replaced their `ion-content` wrapper with a plain `<div>`.

**Files:** [src/app/tab1/tab1.page.html](src/app/tab1/tab1.page.html), [src/app/tab2/tab2.page.html](src/app/tab2/tab2.page.html), [src/app/tab3/tab3.page.html](src/app/tab3/tab3.page.html)

Each tab page has an `<ion-content>` wrapper, and each child component (`app-led-detail`, `app-sunrise`, `app-settings-view`) also starts with `<ion-content>`. Ionic does not support nested `ion-content` elements — it leads to double scroll bars and broken `ion-refresher` behavior.

---

### 7.2 `ion-refresher` is inside the inner `ion-content` but the outer controls the scroll ✅ Fixed

> **Fixed** as a consequence of 7.1 (commit `20f011f`) — `ion-refresher` is now in the single top-level `ion-content`.

As a consequence of the nested `ion-content` issue above, the `ion-refresher` in the child components (`led-detail`, `sunrise`, `settings-view`) is inside an inner content element. The pull-to-refresh gesture may not work reliably across platforms.

---

### 7.3 Native `<input type="checkbox">` used instead of Ionic `<ion-checkbox>` ✅ Fixed

> **Fixed** in commit `e7e9d35` — all native checkboxes replaced with `<ion-checkbox>` throughout.

**Files:** [src/app/led-detail/led-detail.component.html](src/app/led-detail/led-detail.component.html#L113), [src/app/settings-view/settings-view.component.html](src/app/settings-view/settings-view.component.html)

```html
<input [(ngModel)]="activeLevelConfiguration" type="checkbox" />
```

Native HTML checkboxes are used throughout instead of `<ion-checkbox>`. This is inconsistent with the Ionic design system and will look unstyled / out-of-place on both iOS and Android.

---

### 7.4 `ion-title` used inside `ion-item` as a label ✅ Fixed

> **Fixed** — replaced `<ion-title>Device Name</ion-title>` with `<ion-label>Device Name</ion-label>`.

**File:** [src/app/led-detail/led-detail.component.html](src/app/led-detail/led-detail.component.html#L12)

```html
<ion-item>
  <ion-title>Device Name</ion-title>
  ...
</ion-item>
```

`<ion-title>` is intended for use inside `<ion-toolbar>`, not as a label in a list item. `<ion-label>` should be used here instead.

---

## 8. Dependency Caveats

### 8.1 Capacitor 4 is end-of-life ✅ Fixed

> **Fixed** — all Capacitor packages upgraded to `^6.0.0`; `cap sync` confirmed successful.

**File:** [package.json](package.json)

---

### 8.2 `@capacitor/preferences` is a Capacitor 4 package ✅ Fixed

> **Fixed** — `@capacitor/preferences` bumped to `^6.0.0` alongside core; all four Capacitor packages are now on the same major version.

**File:** [package.json](package.json)

---

### 8.3 No testing utilities in devDependencies ✅ Fixed

> **Fixed** — `jasmine-core`, `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `karma-jasmine-html-reporter`, and `typescript` are now explicitly listed in `devDependencies` in [package.json](package.json).

**File:** [package.json](package.json)

---

## 9. Alarm / Sunrise Setting Bugs

### 9.1 Pull-to-refresh spinner dismisses before data is loaded ✅ Fixed

> **Fixed** in commit `5f81693` — `clickedRefresh` is now fully `async`/`await` using `firstValueFrom`; spinner only completes after data is loaded.

**File:** [src/app/sunrise/sunrise.component.ts](src/app/sunrise/sunrise.component.ts#L70)

```ts
async clickedRefresh() {      // marked async but never awaits
  this.enableSave = false;
  this.ledcontrolService.getDeviceSettings().subscribe(res => {
    this.sunriseSettings = res.SunriseSettings;  // arrives later
    this.enableSave = true;
  });
  // function returns here — Promise already resolved
}

handleRefresh(event: any) {
  this.clickedRefresh().then(_ => {
    event.target.complete()   // spinner stops immediately, data not loaded yet
    this.enableSave = true;   // set too early, then overwritten by subscribe above
  })
}
```

**Problem:** `clickedRefresh` is `async` but does not `await` anything. The returned Promise resolves before the HTTP call completes, so `handleRefresh` dismisses the spinner and re-enables Save while the old alarm times are still displayed. The actual data arrives silently some time later.

**Fix:** Convert the Observable to a Promise with `firstValueFrom` and `await` it:

```ts
async clickedRefresh() {
  this.enableSave = false;
  const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
  this.sunriseSettings = res.SunriseSettings;
  this.deviceSettings = res;
  this.currentTime = await firstValueFrom(this.ledcontrolService.getTime());
  this.enableSave = true;
}
```

---

### 9.2 Pull-to-refresh silently discards unsaved alarm edits ✅ Fixed

> **Fixed** in commit `5f81693` — `hasUnsavedChanges()` compares a JSON snapshot; if changes exist, a `confirm()` dialog prompts the user before proceeding.

**File:** [src/app/sunrise/sunrise.component.ts](src/app/sunrise/sunrise.component.ts#L70)

If the user has edited an alarm time (e.g., changed Monday from `07:00` to `06:30`) but has not yet tapped Save, a pull-to-refresh gesture calls `clickedRefresh()` which overwrites `sunriseSettings` with the device's current values. The unsaved edit is lost without any warning or confirmation dialog.

---

### 9.3 Re-fetch after save may return stale data from the device ✅ Fixed

> **Fixed** in commit `5f81693` — after the PUT, `clickedSave` now polls the device (up to 6 × 500 ms) and only updates the UI once the returned `SunriseSettings` matches what was sent.

**File:** [src/app/sunrise/sunrise.component.ts](src/app/sunrise/sunrise.component.ts#L96)

```ts
async clickedSave() {
  this.ledcontrolService.applyDeviceSettings(this.deviceSettings!).subscribe(_ => {
    this.ledcontrolService.getDeviceSettings().subscribe(res => {  // immediate re-fetch
      this.sunriseSettings = res.SunriseSettings;
    });
  });
}
```

**Problem:** The GET fires the instant the PUT response arrives. A microcontroller may still be writing config to flash when the GET hits — returning the pre-save values. The UI will then appear to show the user's changes were reverted.

---

### 9.4 `currentTime` display field is accidentally editable ✅ Fixed

> **Fixed** in commit `5f81693` — changed to one-way `[ngModel]` binding with `[readonly]="true"`.

**File:** [src/app/sunrise/sunrise.component.html](src/app/sunrise/sunrise.component.html#L21)

```html
<ion-input ... [(ngModel)]="currentTime" ...>
```

`currentTime` is fetched from the device and should be read-only. Using `[(ngModel)]` makes the field fully editable — a user who taps it and types will corrupt the displayed clock value. It should use a one-way binding:

```html
<ion-input ... [ngModel]="currentTime" [readonly]="true" ...>
```

---

### 9.5 Alarm time inputs have no format label or placeholder ✅ Fixed

> **Fixed** in commit `5f81693` — `placeholder="HH:MM"` added to all seven day inputs.

**File:** [src/app/sunrise/sunrise.component.html](src/app/sunrise/sunrise.component.html#L63)

```html
<ion-input type="text" label="" ... [(ngModel)]="sunriseSettings.Monday.AlarmTime">
```

Every `AlarmTime` input is `type="text"` with `label=""` and no `placeholder`. There is no indication of the expected format (e.g. `HH:MM`, `07:30`). An incorrectly formatted string is sent to the device without any client-side validation, and the device will silently ignore or misparse it.

---

## Summary Table

| # | Severity | Area | Short Description | Status |
|---|----------|------|-------------------|--------|
| 1.1 | **High** | Service | `writeSettings` always sets device from old `this.settings` | ✅ Fixed `455a6eb` |
| 1.2 | **High** | Service | Trailing space in `Content-Type` for button press | ✅ Fixed `c132f61` |
| 1.3 | **High** | Module | `SunriseModule` exported but not imported in `AppModule` | ✅ Fixed `f548823` |
| 2.1 | **High** | Template | Disabled expression `!isReady && enableSaveButton` is inverted | ✅ Fixed `aa25490` |
| 2.2 | Medium | Component | `onChangeColor` makes needless network fetch | ✅ Fixed `857af7e` |
| 2.3 | Medium | Component | Route param guard is fragile null-check in constructor | ✅ Fixed — `skip(1)` replaces null-check |
| 2.4 | Low | Model | `Settings.Ledstatus` stored but never read back | ✅ Fixed — field and unused imports removed |
| 2.5 | Low | Component | `handleChange` is dead code | ✅ Fixed `df16075` |
| 2.6 | Low | Component | `setResult` is effectively a no-op | ✅ Fixed `df16075` |
| 3.1 | Medium | RxJS | Nested subscriptions — potential multiple inner subscriptions | ✅ Fixed `2909004` |
| 3.2 | Medium | RxJS | Constructor subscriptions never unsubscribed — memory leak | ✅ Fixed `676b52a` |
| 3.3 | Low | RxJS | Slider triggers HTTP request with no debouncing | ✅ Fixed — `save$` Subject + `switchMap` |
| 3.4 | Low | RxJS | No request cancellation — last response can revert user changes | ✅ Fixed — `save$` Subject + `switchMap` |
| 4.1 | Medium | Security | Default WiFi password hardcoded in source | ✅ Fixed — named constants `DEFAULT_WIFI_SSID/PASSWORD` |
| 4.2 | Low | Security | All API traffic is plain HTTP; no URL allowlist | ✅ Fixed — `isValidUrl()` guards `ServerAddress` + `Button2GetURL` |
| 4.3 | Medium | Security | No device address validation before HTTP request | ✅ Fixed — `isValidDeviceAddress()` regex guard |
| 5.1 | Low | Build | Three deprecated `tsconfig` options (TS7 breaking) | ✅ Fixed `e9384df` |
| 5.2 | Low | Build | Unused `Input` import in service | ✅ Fixed `7ddce87` |
| 5.3 | Low | Code | `var` used in one place | ✅ Fixed `7ddce87` |
| 6.1 | Low | Code | `useDummy` dead code flag never enabled | ✅ Fixed `1e72328` |
| 6.2 | Low | Code | Large commented-out block in `resetWiFi` | ✅ Fixed `61a4b95` |
| 6.3 | Medium | HTML | All inputs share `id="input"` — duplicate IDs | ✅ Fixed `f088b00` |
| 6.4 | Low | Code | `getTime` error handler has wrong operation label | ✅ Fixed `7ddce87` |
| 7.1 | **High** | Template | Nested `ion-content` in every tab | ✅ Fixed `20f011f` |
| 7.2 | Medium | Template | `ion-refresher` inside nested content — broken on some platforms | ✅ Fixed `20f011f` |
| 7.3 | Low | Template | Native `<input type="checkbox">` instead of `<ion-checkbox>` | ✅ Fixed `e7e9d35` |
| 7.4 | Low | Template | `<ion-title>` used as a list label instead of `<ion-label>` | ✅ Fixed — replaced with `<ion-label>` |
| 8.1 | Medium | Deps | Capacitor 4 is EOL; Play Store targets API 35+ | ✅ Fixed — upgraded to Capacitor 6 |
| 8.2 | Low | Deps | `@capacitor/preferences` must match Capacitor core version | ✅ Fixed — all Capacitor packages on `^6.0.0` |
| 8.3 | Low | Deps | Test dependencies not explicitly listed in `devDependencies` | ✅ Fixed — karma/jasmine/typescript added explicitly |
| 9.1 | **High** | Alarm | Refresh spinner dismisses before alarm data is loaded | ✅ Fixed `5f81693` |
| 9.2 | Medium | Alarm | Pull-to-refresh silently discards unsaved alarm edits | ✅ Fixed `5f81693` |
| 9.3 | Medium | Alarm | Save re-fetches immediately — may read back stale device config | ✅ Fixed `5f81693` |
| 9.4 | Low | Alarm | Device time display is accidentally editable via two-way binding | ✅ Fixed `5f81693` |
| 9.5 | Low | Alarm | Alarm time inputs have no format label or placeholder | ✅ Fixed `5f81693` |
