import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { skip, switchMap, takeUntil } from 'rxjs/operators';
import { DeviceSettings, SunriseSettings, DaySetting, Settings } from '../settings'
import { LocalstorageService } from '../services/localstorage.service'
import { LedcontrolService } from '../services/ledcontrol.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  standalone: false,
  selector: 'app-sunrise',
  templateUrl: './sunrise.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./sunrise.component.scss'],
})
export class SunriseComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  settings?: Settings;
  sunriseSettings?: SunriseSettings;
  deviceSettings?: DeviceSettings;
  currentTime = "-";
  enableSave = true;
  private savedSunriseJson?: string;


  constructor(
    private localStorage: LocalstorageService,
    private ledcontrolService: LedcontrolService,
    private activatedRoute: ActivatedRoute) {
      this.activatedRoute.params.pipe(skip(1), takeUntil(this.destroy$)).subscribe(params => {
        console.log(params["id"]);
        this.clickedRefresh();
      });
    }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }



  async ngOnInit() {
    console.log("init view comp");
    const resSettings = await this.localStorage.readSettings();
    this.settings = resSettings;
    this.ledcontrolService.setDevice(this.settings.CurrentDevice);
    try {
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      this.sunriseSettings = res.SunriseSettings;
      this.deviceSettings = res;
      this.snapshotSavedSunrise();
    } catch (e) { console.error(e); }

    try {
      this.currentTime = await firstValueFrom(this.ledcontrolService.getTime());
    } catch (e) { console.error(e); }
  }

  handleRefresh(event: any) {
    this.clickedRefresh().then(_ => {
      console.log("handle Refresher complete")
      event.target.complete()
      this.enableSave = true;
    })
  };


  async clickedRefresh() {
    if (this.hasUnsavedChanges()) {
      const ok = confirm('You have unsaved changes. Refresh will discard them. Continue?');
      if (!ok) return;
    }

    this.enableSave = false;
    try {
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      this.sunriseSettings = res.SunriseSettings;
      this.deviceSettings = res;
      this.snapshotSavedSunrise();
      console.log(JSON.stringify(res));
    } catch (e) { console.error(e); }

    try {
      this.currentTime = await firstValueFrom(this.ledcontrolService.getTime());
      console.log('Current Time ' + this.currentTime);
    } catch (e) { console.error(e); }

    this.enableSave = true;
  }

  async clickedSave() {
    this.enableSave = false;
    console.log(JSON.stringify(this.deviceSettings));
    try {
      await firstValueFrom(this.ledcontrolService.applyDeviceSettings(this.deviceSettings!));

      // Poll device for updated settings — some microcontrollers take time to write to flash.
      const maxAttempts = 6;
      const delayMs = 500;
      let lastRes: any = undefined;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, delayMs));
        try {
          lastRes = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
          if (JSON.stringify(lastRes.SunriseSettings) === JSON.stringify(this.deviceSettings!.SunriseSettings)) {
            this.deviceSettings = lastRes;
            this.sunriseSettings = lastRes.SunriseSettings;
            this.snapshotSavedSunrise();
            break;
          }
        } catch (err) {
          console.error(err);
        }
      }

      if (!this.deviceSettings && lastRes) {
        this.deviceSettings = lastRes;
        this.sunriseSettings = lastRes.SunriseSettings;
        this.snapshotSavedSunrise();
      }

    } catch (e) {
      console.error(e);
    }

    this.enableSave = true;
  }

  private snapshotSavedSunrise() {
    try {
      this.savedSunriseJson = JSON.stringify(this.sunriseSettings || {});
    } catch (e) {
      this.savedSunriseJson = undefined;
    }
  }

  private hasUnsavedChanges(): boolean {
    if (!this.savedSunriseJson) return false;
    try {
      return JSON.stringify(this.sunriseSettings || {}) !== this.savedSunriseJson;
    } catch (e) {
      return false;
    }
  }

}


