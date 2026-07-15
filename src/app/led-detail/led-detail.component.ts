import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { finalize, skip, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ActivatedRoute } from '@angular/router'
import { debounceTime } from 'rxjs/operators';
import { LedcontrolService } from '../services/ledcontrol.service';
import {
  LEDStatus, LEDStatusJSON, LabeledLedMode, LED_ON, LED_OFF, LED_PULSE,
  LED_CAMPFIRE, LED_COLORS, LED_SUNRISE, LEDMode,
  LightLevel, Level, LIGHT_FIRST, LIGHT_SECOND, LIGHT_THIRD
} from '../ledstatus';
import { Settings, DeviceSettings } from '../settings';
import { LocalstorageService } from '../services/localstorage.service';

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
  ledStatusJson?: LEDStatusJSON;
  enableSaveButton: boolean = false
  selectedLevel: LightLevel = LIGHT_FIRST;
  private loadingCount = 0;

  constructor(private ledcontrolService: LedcontrolService,
    private localStorage: LocalstorageService,
    private activeRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef) {
    this.activeRoute.params.pipe(skip(1), takeUntil(this.destroy$)).subscribe(params => {
      console.log(JSON.stringify(params));
      this.onRefresh();
    });
  }

  get isReady(): boolean {
    if (this.loadingCount < 0) {
      console.warn("Loading count is negative: " + this.loadingCount);
      this.loadingCount = 0;
    }
    if (this.loadingCount > 0) {
      console.log("Loading count: " + this.loadingCount);
    }
    return this.loadingCount === 0;
  }
  private startLoading(): void {
    this.loadingCount++;
  }
  private stopLoading(): void {
    if (this.loadingCount > 0) this.loadingCount--;
    this.cdr.detectChanges();
  }
  activeLevelConfiguration = false;

  ledStatus: LEDStatus = {
    red: 0,
    green: 0,
    blue: 0,
    brightness: 35,
    mode: LED_OFF,
    message: "Not Connected",
  };
  settings?: Settings;
  deviceSettings?: DeviceSettings;

  ledModes: LabeledLedMode[] = [
    LED_ON,
    LED_OFF,
    LED_CAMPFIRE,
    LED_COLORS,
    LED_SUNRISE,
    LED_PULSE,
  ];

  lightLevels: LightLevel[] = [
    LIGHT_FIRST,
    LIGHT_SECOND,
    LIGHT_THIRD,
  ];


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit() {
    console.log("On init");
    this.settings = await this.localStorage.readSettings();
    this.ledcontrolService.setDevice(this.settings.CurrentDevice);

    this.save$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),   // wait 300ms of silence before firing
      tap(() => this.startLoading()),   // one start per request that actually fires
      switchMap(() => this.ledcontrolService.saveStatus(this.getJson()).pipe(
        finalize(() => this.stopLoading())   // runs on next, error, and switchMap cancel
      ))
    ).subscribe({
      next: (ledJson) => {
        console.log('Answer: ' + JSON.stringify(ledJson));
      },
      error: (error) => {
        console.error('Observer got an error: ' + error);
        this.ledStatus = {
          red: 0, green: 0, blue: 0, brightness: 0,
          message: 'No connection', mode: LED_OFF
        };
      }
    });

    this.onRefresh();
  }

  pinFormatter(value: number) {
    return `${value}%`;
  }

  onSliderChange(ev: Event) {
    this.onSave();
    if (this.activeLevelConfiguration) {
      switch (this.selectedLevel.id) {
        case Level.First:
          this.deviceSettings!.LightLow.Red = this.ledStatus.red
          this.deviceSettings!.LightLow.Green = this.ledStatus.green
          this.deviceSettings!.LightLow.Blue = this.ledStatus.blue
          break;
        case Level.Second:
          this.deviceSettings!.LightMedium.Red = this.ledStatus.red
          this.deviceSettings!.LightMedium.Green = this.ledStatus.green
          this.deviceSettings!.LightMedium.Blue = this.ledStatus.blue
          break;
        case Level.Third:
          this.deviceSettings!.LightHigh.Red = this.ledStatus.red
          this.deviceSettings!.LightHigh.Green = this.ledStatus.green
          this.deviceSettings!.LightHigh.Blue = this.ledStatus.blue
          break;
      }
    }
  }


  onSelectChange(value: LabeledLedMode): void {
    if (this.ledStatus) {
      this.ledStatus.mode = value;
      if (this.ledStatus.mode == null) {
        console.log("mode not defined: " + value);
      }
      this.onSave();   // route through save$ queue so it can't race a slider save
    }
  }

  onSelectLevel(value: LightLevel): void {
    if (this.deviceSettings == null) {
      return
    }
    switch (value.id) {
      case Level.First:
        this.ledStatus.red = this.deviceSettings!.LightLow.Red
        this.ledStatus.green = this.deviceSettings!.LightLow.Green
        this.ledStatus.blue = this.deviceSettings!.LightLow.Blue
        break;
      case Level.Second:
        this.ledStatus.red = this.deviceSettings!.LightMedium.Red
        this.ledStatus.green = this.deviceSettings!.LightMedium.Green
        this.ledStatus.blue = this.deviceSettings!.LightMedium.Blue
        break;
      case Level.Third:
        this.ledStatus.red = this.deviceSettings!.LightHigh.Red
        this.ledStatus.green = this.deviceSettings!.LightHigh.Green
        this.ledStatus.blue = this.deviceSettings!.LightHigh.Blue
        break;
    }
    this.applyLEDStatus(this.getJson())
    this.onSave()
  }

  onSaveColor(): void {
    switch (this.selectedLevel.id) {
      case Level.First:
        this.deviceSettings!.LightLow.Red = this.ledStatus.red
        this.deviceSettings!.LightLow.Green = this.ledStatus.green
        this.deviceSettings!.LightLow.Blue = this.ledStatus.blue
        break;
      case Level.Second:
        this.deviceSettings!.LightMedium.Red = this.ledStatus.red
        this.deviceSettings!.LightMedium.Green = this.ledStatus.green
        this.deviceSettings!.LightMedium.Blue = this.ledStatus.blue
        break;
      case Level.Third:
        this.deviceSettings!.LightHigh.Red = this.ledStatus.red
        this.deviceSettings!.LightHigh.Green = this.ledStatus.green
        this.deviceSettings!.LightHigh.Blue = this.ledStatus.blue
        break;
    }
    this.enableSaveButton = false
    this.ledcontrolService.saveDeviceSettings(this.deviceSettings!).subscribe({
      next: (res) => {
        if (res != null) {
          this.enableSaveButton = true
        }
      },
      error: (error) => {
        console.error('Failed to connect to : ' + this.settings?.CurrentDevice.Name + ' ' + error)
        throw error
      }
    });
  }

  compareLevelFn(e1: LightLevel, e2: LightLevel): boolean {
    return e1 && e2 ? e1.id === e2.id : e1 === e2;
  }

  onSave(): void {
    if (this.ledStatus) {
      this.save$.next();
    }
  }

  onPower(): void {
    if (this.ledStatus) {
      if (this.ledStatus.mode != LED_OFF) {
        this.ledStatus.mode = LED_OFF;
        console.log("Power button: turn off");
      } else {
        this.ledStatus.mode = LED_ON;
        console.log("Power button: turn on");
      }
      this.onSave();
    }
  }

  onButton1(): void {
    this.startLoading();
    this.ledcontrolService.pressButton("1").pipe(
      switchMap(() => {
        this.enableSaveButton = true;
        return this.ledcontrolService.getLedStatus();
      })
    ).subscribe({
      next: (ledJson) => {
        console.log('Answer:' + JSON.stringify(ledJson));
        this.applyLEDStatus(ledJson);
        this.stopLoading();
      },
      error: (error) => {
        console.error('Observer got an error: ' + error);
        this.stopLoading();
      }
    });
  }

  onButton2(): void {
    this.startLoading();
    this.ledcontrolService.pressButton("2").pipe(
      switchMap(() => {
        this.enableSaveButton = true;
        return this.ledcontrolService.getLedStatus();
      })
    ).subscribe({
      next: (ledJson) => {
        console.log('Answer:' + JSON.stringify(ledJson));
        this.applyLEDStatus(ledJson);
        this.stopLoading();
      },
      error: (error) => {
        console.error('Observer got an error: ' + error);
        this.stopLoading();
      }
    });
  }

  handleRefresh(event: any) {
    this.onRefresh().then(_ => {
      console.log("handle Refresher complete")
      event.target.complete()
    })
  };

  async onRefresh() {
    this.startLoading();
    try {
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (res != null) {
        this.enableSaveButton = true;
        this.deviceSettings = res;
        const ledJson = await firstValueFrom(this.ledcontrolService.getLedStatus());
        if (ledJson != null) {
          this.applyLEDStatus(ledJson);
        }
      }
    } catch (error) {
      console.error('Observer got an error: ' + error);
      this.ledStatus = {
        red: 0, green: 0, blue: 0, brightness: 0,
        message: 'No connection', mode: LED_OFF
      };
    } finally {
      this.stopLoading();
    }
  }

  onChangeColor() {
    this.startLoading();
    const ledstatus = this.getJson();
    const color = Math.floor(Math.random() * 6);
    switch (color) {
      case 0:
        console.log("red");
        this.ledStatus!.message = "red";
        ledstatus.Red = 100; ledstatus.Blue = 0; ledstatus.Green = 0;
        break;
      case 1:
        console.log("blue");
        this.ledStatus!.message = "blue";
        ledstatus.Red = 0; ledstatus.Blue = 100; ledstatus.Green = 0;
        break;
      case 2:
        console.log("green");
        this.ledStatus!.message = "green";
        ledstatus.Red = 0; ledstatus.Blue = 0; ledstatus.Green = 100;
        break;
      case 3:
        console.log("bg");
        this.ledStatus!.message = "bg";
        ledstatus.Red = 0; ledstatus.Blue = 50; ledstatus.Green = 50;
        break;
      case 4:
        console.log("rg");
        this.ledStatus!.message = "rg";
        ledstatus.Red = 50; ledstatus.Blue = 0; ledstatus.Green = 50;
        break;
      case 5:
        console.log("rb");
        this.ledStatus!.message = "rb";
        ledstatus.Red = 50; ledstatus.Blue = 50; ledstatus.Green = 0;
        break;
    }
    this.applyLEDStatus(ledstatus);
    this.onSave();
  }

  compareFn(e1: LabeledLedMode, e2: LabeledLedMode): boolean {
    return e1 && e2 ? e1.id === e2.id : e1 === e2;
  }

  applyLEDStatus(jsonStatus: LEDStatusJSON) {
    if (this.ledStatus == null) {
      this.ledStatus = {
        red: jsonStatus.Red,
        green: jsonStatus.Green,
        blue: jsonStatus.Blue,
        brightness: jsonStatus.Brightness,
        mode: LED_OFF,
        message: jsonStatus.Message
      }
    } else {

      this.ledStatus.message = jsonStatus.Message;
      this.ledStatus.brightness = jsonStatus.Brightness;
      this.ledStatus.red = jsonStatus.Red;
      this.ledStatus.green = jsonStatus.Green;
      this.ledStatus.blue = jsonStatus.Blue;
      switch (jsonStatus.Mode) {
        case LEDMode.on:
          this.ledStatus.mode = LED_ON;
          break
        case LEDMode.off:
          this.ledStatus.mode = LED_OFF;
          break
        case LEDMode.campfire:
          this.ledStatus.mode = LED_CAMPFIRE;
          break
        case LEDMode.colorful:
          this.ledStatus.mode = LED_COLORS;
          break
        case LEDMode.pulse:
          this.ledStatus.mode = LED_PULSE;
          break
        case LEDMode.sunrise:
          this.ledStatus.mode = LED_SUNRISE;
          break
        default:
          this.ledStatus.mode = LED_OFF;
          break
      }

    }
    console.log("Mode: " + this.ledStatus.mode.id);
  }

  getJson(): LEDStatusJSON {
    const jsonLED: LEDStatusJSON = {
      Red: this.ledStatus!.red,
      Green: this.ledStatus!.green,
      Blue: this.ledStatus!.blue,
      Brightness: this.ledStatus!.brightness,
      Mode: this.ledStatus!.mode.id,
      Message: this.ledStatus!.message,
    }
    return jsonLED;
  }
}
