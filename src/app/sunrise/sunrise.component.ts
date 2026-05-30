import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DeviceSettings, SunriseSettings, DaySetting, Settings } from '../settings'
import { LocalstorageService } from '../services/localstorage.service'
import { LedcontrolService } from '../services/ledcontrol.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-sunrise',
  templateUrl: './sunrise.component.html',
  styleUrls: ['./sunrise.component.scss'],
})
export class SunriseComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  settings?: Settings;
  sunriseSettings?: SunriseSettings;
  deviceSettings?: DeviceSettings;
  currentTime = "-";
  enableSave = true;


  constructor(
    private localStorage: LocalstorageService,
    private ledcontrolService: LedcontrolService,
    private activatedRoute: ActivatedRoute) {
      this.activatedRoute.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        console.log(params["id"]);
        if (this.deviceSettings != null) {
          this.clickedRefresh();
        }
      });
    }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }



  async ngOnInit() {
    console.log("init view comp");
    await this.localStorage.readSettings().then(
      res => {
        this.settings = res
        this.ledcontrolService.setDevice(this.settings.CurrentDevice)
        this.ledcontrolService.getDeviceSettings().subscribe(
          {
            next: (res) => {
              this.sunriseSettings = res.SunriseSettings;
              this.deviceSettings = res;
            },
            error: (e) => console.error(e),
            complete: () => console.info('complete') 
        })
        this.ledcontrolService.getTime().subscribe(
          {
           next : (res) => {
              this.currentTime = res;
            },
            error: (e) => console.error(e),
            complete: () => console.info('complete') 
        })
      }
    );
  }

  handleRefresh(event: any) {
    this.clickedRefresh().then(_ => {
      console.log("handle Refresher complete")
      event.target.complete()
      this.enableSave = true;
    })
  };


  async clickedRefresh() {
    this.enableSave = false;
    this.ledcontrolService.getDeviceSettings().subscribe(res => {
      this.sunriseSettings = res.SunriseSettings
      this.deviceSettings = res;
      console.log(JSON.stringify(res))
      this.enableSave = true;
    });
    this.ledcontrolService.getTime().subscribe(
      {
        next: (res) => {
          this.currentTime = res;
          console.log("Current Time " + res)

        },
        error: (e) => console.error(e),
        complete: () => console.info('complete') 
    })
  }

  async clickedSave() {
    this.enableSave = false;
    console.log(JSON.stringify(this.deviceSettings));
    this.ledcontrolService.applyDeviceSettings(this.deviceSettings!).pipe(
      switchMap(() => this.ledcontrolService.getDeviceSettings())
    ).subscribe(res => {
      this.deviceSettings = res;
      this.sunriseSettings = res.SunriseSettings;
      this.enableSave = true;
    });
  }

}


