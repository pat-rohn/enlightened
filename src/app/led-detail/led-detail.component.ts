import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { EMPTY, Subject, firstValueFrom } from 'rxjs';
import { catchError, debounceTime, switchMap, takeUntil } from 'rxjs/operators';

import { LedcontrolService } from '../services/ledcontrol.service';
import {
  LEDStatus, LEDStatusJSON, LabeledLedMode, LED_ON, LED_OFF, LED_PULSE,
  LED_CAMPFIRE, LED_COLORS, LED_SUNRISE, LEDMode,
  LightLevel, Level, LIGHT_FIRST, LIGHT_SECOND, LIGHT_THIRD
} from '../ledstatus';
import { Settings, DeviceSettings, Light } from '../settings';
import { LocalstorageService } from '../services/localstorage.service';
import { APP_VERSION } from '../../environments/version';

type ColorChannel = 'red' | 'green' | 'blue' | 'brightness';

@Component({
  standalone: false,
  selector: 'app-led-detail',
  templateUrl: './led-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./led-detail.component.scss'],
})
export class LedDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly save$ = new Subject<void>();

  readonly version = APP_VERSION;

  // Reactive state. Signal writes schedule change detection on their own, so a
  // device reply that lands outside Angular's zone (CapacitorHttp) refreshes the
  // view without any NgZone.run()/detectChanges() plumbing.
  readonly ledStatus = signal<LEDStatus>({
    red: 0, green: 0, blue: 0, brightness: 35, mode: LED_OFF, message: 'Not Connected',
  });
  readonly deviceSettings = signal<DeviceSettings | undefined>(undefined);
  readonly settings = signal<Settings | undefined>(undefined);

  // User-driven, always mutated from in-zone DOM events — plain fields are fine.
  activeLevelConfiguration = false;
  selectedLevel: LightLevel = LIGHT_FIRST;

  readonly ledModes: LabeledLedMode[] = [LED_ON, LED_OFF, LED_CAMPFIRE, LED_COLORS, LED_SUNRISE, LED_PULSE];
  readonly lightLevels: LightLevel[] = [LIGHT_FIRST, LIGHT_SECOND, LIGHT_THIRD];

  constructor(
    private ledcontrolService: LedcontrolService,
    private localStorage: LocalstorageService) {
  }

  async ngOnInit(): Promise<void> {
    const settings = await this.localStorage.readSettings();
    this.settings.set(settings);
    this.ledcontrolService.setDevice(settings.CurrentDevice);

    // Coalesce rapid edits into one write; a newer save cancels an in-flight one.
    // A failed save must not error the outer pipe (that would kill all future
    // saves), so it is caught per-request and dropped.
    this.save$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      switchMap(() => this.ledcontrolService.saveStatus(this.getJson()).pipe(
        catchError((err) => {
          console.error('Save failed: ' + err);
          return EMPTY;
        }),
      )),
    ).subscribe({
      next: (res) => console.log('Saved LED status: ' + JSON.stringify(res)),
    });

    this.onRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Passed to <ion-range [pinFormatter]> — arrows keep `this` unbound-safe.
  readonly pinFormatter = (value: number): string => `${value}%`;
  readonly colorPin = (value: number): string => `${value}`;

  // --- Sliders --------------------------------------------------------------
  onColorInput(channel: ColorChannel, ev: Event): void {
    const value = Number((ev as CustomEvent).detail?.value ?? 0);
    this.ledStatus.update((s) => ({ ...s, [channel]: value }));
  }

  onSliderEnd(): void {
    this.onSave();
    if (this.activeLevelConfiguration) {
      this.writeLevelColors(this.selectedLevel.id);
    }
  }

  // --- Mode / level selects -------------------------------------------------
  onSelectChange(value: LabeledLedMode): void {
    this.ledStatus.update((s) => ({ ...s, mode: value }));
    this.onSave();
  }

  onSelectLevel(value: LightLevel): void {
    const rgb = this.readLevelColors(value.id);
    if (rgb == null) return;
    this.ledStatus.update((s) => ({ ...s, red: rgb.Red, green: rgb.Green, blue: rgb.Blue }));
    this.onSave();
  }

  onSaveColor(): void {
    const ds = this.writeLevelColors(this.selectedLevel.id);
    if (ds == null) return;
    this.ledcontrolService.saveDeviceSettings(ds).subscribe({
      next: (res) => console.log('Saved device settings: ' + JSON.stringify(res)),
      error: (err) => console.error('Failed to connect to: ' + this.settings()?.CurrentDevice.Name + ' ' + err),
    });
  }

  compareFn(e1: LabeledLedMode, e2: LabeledLedMode): boolean {
    return e1 && e2 ? e1.id === e2.id : e1 === e2;
  }

  compareLevelFn(e1: LightLevel, e2: LightLevel): boolean {
    return e1 && e2 ? e1.id === e2.id : e1 === e2;
  }

  // --- Buttons --------------------------------------------------------------
  onSave(): void {
    this.save$.next();
  }

  onPower(): void {
    this.ledStatus.update((s) => ({ ...s, mode: s.mode !== LED_OFF ? LED_OFF : LED_ON }));
    this.onSave();
  }

  onChangeColor(): void {
    const palette: Array<[string, number, number, number]> = [
      ['red', 255, 0, 0],
      ['blue', 0, 0, 255],
      ['green', 0, 255, 0],
      ['bg', 0, 128, 128],
      ['rg', 128, 128, 0],
      ['rb', 128, 0, 128],
    ];
    const [message, red, green, blue] = palette[Math.floor(Math.random() * palette.length)];
    this.ledStatus.update((s) => ({ ...s, red, green, blue, message }));
    this.onSave();
  }

  onButton1(): void {
    this.pressButton('1');
  }

  onButton2(): void {
    this.pressButton('2');
  }

  private pressButton(nr: string): void {
    this.ledcontrolService.pressButton(nr).pipe(
      switchMap(() => this.ledcontrolService.getLedStatus()),
    ).subscribe({
      next: (led) => { if (led != null) this.applyLEDStatus(led); },
      error: (err) => console.error('Button ' + nr + ' failed: ' + err),
    });
  }

  // --- Refresh --------------------------------------------------------------
  handleRefresh(event: any): void {
    this.onRefresh().then(() => event.target.complete());
  }

  async onRefresh(): Promise<void> {
    try {
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (res == null) return;
      this.deviceSettings.set(res);
      const led = await firstValueFrom(this.ledcontrolService.getLedStatus());
      if (led != null) this.applyLEDStatus(led);
    } catch (err) {
      console.error('Refresh failed: ' + err);
      this.ledStatus.set({ red: 0, green: 0, blue: 0, brightness: 0, message: 'No connection', mode: LED_OFF });
    }
  }

  // --- Helpers --------------------------------------------------------------
  private levelKey(id: Level): 'LightLow' | 'LightMedium' | 'LightHigh' {
    return id === Level.First ? 'LightLow' : id === Level.Second ? 'LightMedium' : 'LightHigh';
  }

  private readLevelColors(id: Level): Light | undefined {
    const ds = this.deviceSettings();
    if (ds == null) return undefined;
    const lvl = ds[this.levelKey(id)];
    return { Red: lvl.Red, Green: lvl.Green, Blue: lvl.Blue };
  }

  // Copies the current colour into the given level and returns the updated
  // settings (or undefined if none are loaded yet).
  private writeLevelColors(id: Level): DeviceSettings | undefined {
    const ds = this.deviceSettings();
    if (ds == null) return undefined;
    const s = this.ledStatus();
    const light: Light = { Red: s.red, Green: s.green, Blue: s.blue };
    const next: DeviceSettings = {
      ...ds,
      LightLow: id === Level.First ? light : ds.LightLow,
      LightMedium: id === Level.Second ? light : ds.LightMedium,
      LightHigh: id === Level.Third ? light : ds.LightHigh,
    };
    this.deviceSettings.set(next);
    return next;
  }

  applyLEDStatus(json: LEDStatusJSON): void {
    this.ledStatus.set({
      red: json.Red,
      green: json.Green,
      blue: json.Blue,
      brightness: json.Brightness,
      message: json.Message,
      mode: this.toLabeledMode(json.Mode),
    });
  }

  private toLabeledMode(mode: number): LabeledLedMode {
    switch (mode) {
      case LEDMode.on: return LED_ON;
      case LEDMode.off: return LED_OFF;
      case LEDMode.campfire: return LED_CAMPFIRE;
      case LEDMode.colorful: return LED_COLORS;
      case LEDMode.pulse: return LED_PULSE;
      case LEDMode.sunrise: return LED_SUNRISE;
      default: return LED_OFF;
    }
  }

  getJson(): LEDStatusJSON {
    const s = this.ledStatus();
    return {
      Red: s.red,
      Green: s.green,
      Blue: s.blue,
      Brightness: s.brightness,
      Mode: s.mode.id,
      Message: s.message,
    };
  }
}
