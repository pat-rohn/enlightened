import { Component, OnInit } from '@angular/core';

import { ActivatedRoute } from '@angular/router'
import { LedcontrolService } from '../services/ledcontrol.service';
import {
  LEDStatus, LEDStatusJSON, LabeledLedMode, LED_ON, LED_OFF, LED_PULSE,
  LED_CAMPFIRE, LED_COLORS, LED_SUNRISE, LEDMode,
  LightLevel, Level, LIGHT_FIRST, LIGHT_SECOND, LIGHT_THIRD
} from '../ledstatus';
import { Settings, DeviceSettings } from '../settings';
import { LocalstorageService } from '../services/localstorage.service';

@Component({
  selector: 'app-led-detail',
  templateUrl: './led-detail.component.html',
  styleUrls: ['./led-detail.component.scss'],
})
export class LedDetailComponent implements OnInit {
  ledStatusJson?: LEDStatusJSON;
  enableSaveButton: boolean = false
  selectedLevel: LightLevel = LIGHT_FIRST;
  isReady = true;
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

  constructor(private ledcontrolService: LedcontrolService,
    private localStorage: LocalstorageService,
    private activeRoute: ActivatedRoute) {
    this.activeRoute.params.subscribe(params => {
      console.log(JSON.stringify(params));
      //if (params["id"] == "LedDetails") {
      if (this.deviceSettings != null) {
        this.onRefresh();
      }
      //}
    });
  }

  async ngOnInit() {
    console.log("On init");
    this.settings = await this.localStorage.readSettings();
    this.ledcontrolService.setDevice(this.settings.CurrentDevice);
    this.ledcontrolService.getDeviceSettings().subscribe(res => {
      this.enableSaveButton = true
      this.deviceSettings = res
      this.ledcontrolService.getLedStatus().subscribe(
        {
          next: (ledJson) => {
            console.log('Answer:' + JSON.stringify(ledJson));
            this.applyLEDStatus(ledJson);
          },
          error: (error) => {
            console.error('Observer got an error: ' + error)
            this.isReady = false;
          },
          complete: () => {
          }
        }
      )
    });

    if (this.ledStatus != null) {
      console.log("On init: " + this.ledStatus.message);
    }
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
    console.log("ion change");
    this.isReady = false
    var mode = value;
    if (this.ledStatus) {
      console.log("change mode");
      this.ledStatus.mode = mode;
      if (this.ledStatus.mode == null) {
        console.log("mode not defined: " + value);
      }
      this.ledcontrolService.saveStatus(this.getJson())
        .subscribe({
          next: (ledJson) => {
            console.log('Answer:' + JSON.stringify(ledJson));
            this.isReady = true;
          },
          error: (error) => {
            console.error('Observer got an error: ' + error)
            this.ledStatus = {
              red: 0,
              green: 0,
              blue: 0,
              brightness: 0,
              message: "No connection",
              mode: LED_OFF
            }
          },
        });
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
      this.isReady = false;
      this.ledcontrolService.saveStatus(this.getJson())
        .subscribe(
          {
            next: (ledJson) => {
              console.log('Answer: ' + JSON.stringify(ledJson));
              this.isReady = true;
            },
            error: (error) => {
              console.error('Observer got an error: ' + error)
              this.ledStatus = {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 0,
                message: "No connection",
                mode: LED_OFF
              }
            },
          }
        );
    }
  }

  onPower(): void {
    this.isReady = false
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
    this.isReady = false
    this.ledcontrolService.pressButton("1").subscribe(res =>{
      this.enableSaveButton = true
      this.ledcontrolService.getLedStatus().subscribe(
        {
          next: (ledJson) => {
            console.log('Answer:' + JSON.stringify(ledJson));
            this.applyLEDStatus(ledJson);
            this.isReady = true
          },
          error: (error) => {
            console.error('Observer got an error: ' + error)
            this.isReady = false;
          },
          complete: () => {
          }
        }
      )
    })
  }

  onButton2(): void {
    this.isReady = false
    this.ledcontrolService.pressButton("2").subscribe(res =>{
      this.enableSaveButton = true
      this.ledcontrolService.getLedStatus().subscribe(
        {
          next: (ledJson) => {
            console.log('Answer:' + JSON.stringify(ledJson));
            this.applyLEDStatus(ledJson);
            this.isReady = true
          },
          error: (error) => {
            console.error('Observer got an error: ' + error)
            this.isReady = false;
          },
          complete: () => {
          }
        }
      )
    })
  }

  handleRefresh(event: any) {
    this.onRefresh().then(_ => {
      console.log("handle Refresher complete")
      event.target.complete()
      this.isReady = true;
    }
    )
  };

  async onRefresh() {
    this.isReady = false
    this.ledcontrolService.getDeviceSettings().subscribe(res => {
      this.deviceSettings = res
      this.ledcontrolService.getLedStatus().subscribe(
        {
          next: (ledJson) => {
            console.log('Answer:' + JSON.stringify(ledJson));
            this.applyLEDStatus(ledJson);
            this.isReady = true
          },
          error: (error) => {
            console.error('Observer got an error: ' + error)
            this.ledStatus = {
              red: 0,
              green: 0,
              blue: 0,
              brightness: 0,
              message: "No connection",
              mode: LED_OFF
            }
          },
          complete: () => {
          }
        }
      )
    });
  }

  onChangeColor() {
    this.isReady = false;
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
    var jsonLED: LEDStatusJSON = {
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
