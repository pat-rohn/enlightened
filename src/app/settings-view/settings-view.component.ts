import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DeviceSettings, Settings, Device } from '../settings';
import { LocalstorageService } from '../services/localstorage.service'
import { LedcontrolService } from '../services/ledcontrol.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-settings-view',
  templateUrl: './settings-view.component.html',
  styleUrls: ['./settings-view.component.scss'],
})
export class SettingsViewComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  settings: Settings = this.localStorage.settings;
  connectedDevice: Device = { Name: "init", Address: "0" }
  deviceConfig?: DeviceSettings;
  enableSave = true;

  constructor(
    private localStorage: LocalstorageService,
    private ledcontrolService: LedcontrolService,
    private activeRoute: ActivatedRoute) {
    this.activeRoute.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      console.log(params["id"]);
      if (this.deviceConfig != null) {
        this.clickedRefreshDevice();
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
        this.ledcontrolService.setDevice(res.CurrentDevice)
        this.connectedDevice = Object.assign({}, res.CurrentDevice!)
        this.ledcontrolService.getDeviceSettings().subscribe(res => {
          this.deviceConfig = res
        }
        );
      }
    );
  }

  async onSelect() {
    let dev = this.findDevice(this.connectedDevice.Name)
    this.settings!.CurrentDevice = Object.assign({}, dev!)
    console.error("onSave: current Device " + JSON.stringify(this.connectedDevice))
    this.ledcontrolService.setDevice(dev!)
    this.clickedRefreshDevice()
  }

  compareDevice(o1: Device, o2: Device) {
    return o1.Name && o2.Name ? o1.Name === o2.Name : o1.Name === o2.Name;
  }

  handleRefresh(event: any) {
    this.clickedRefreshDevice().then(_ => {
      console.log("handle Refresher complete")
      this.enableSave = true;
      event.target.complete()

      this.ledcontrolService.setDevice(this.settings!.CurrentDevice)
    })
  };


  async clickedRefreshDevice() {
    console.log("Disable Save")
    this.enableSave = false;
    this.ledcontrolService.getDeviceSettings().subscribe({
      next: res => {
        this.deviceConfig = res;
        this.enableSave = true;
        console.log("Enable Save")
      },
      error: err => console.log(err),
    }
    );
  }

  async clickedApplyDeviceConfig() {
    console.log("Disable Save");
    this.enableSave = false;
    console.log(JSON.stringify(this.deviceConfig));
    this.ledcontrolService.applyDeviceSettings(this.deviceConfig!).pipe(
      switchMap(() => this.ledcontrolService.getDeviceSettings())
    ).subscribe(res => {
      this.deviceConfig = res;
      this.enableSave = true;
    });
  }

  async clickedRestart() {
    console.log("Restart");
    this.enableSave = false;
    console.log(JSON.stringify(this.deviceConfig));
    this.ledcontrolService.restartDevice().pipe(
      switchMap(() => this.ledcontrolService.getDeviceSettings())
    ).subscribe(res => {
      this.deviceConfig = res;
      this.enableSave = true;
    });
  }

  async resetWiFi() {
    if (this.deviceConfig != null) {
      this.deviceConfig.IsConfigured = false;
      this.deviceConfig.ServerAddress = "http://localhost:3000";
      this.deviceConfig.WiFiName = "Enlighted";
      this.deviceConfig.WiFiPassword = "enlighten-me";
      this.deviceConfig.IsOfflineMode = true;
      /*this.deviceSettings.FindSensors = false;
      this.deviceSettings.SensorID = "9999";
      this.deviceSettings.NumberOfLEDs = -1;
      this.deviceSettings.DhtPin = -1;
      this.deviceSettings.WindSensorPin = -1;
      this.deviceSettings.RainfallSensorPin = -1;
      this.deviceSettings.LEDPin = -1;
      this.deviceSettings.Button1 = -1;
      this.deviceSettings.Button2 = -1;
      this.deviceSettings.ShowWebpage = true;
      this.deviceSettings.UseMQTT = true;
      this.deviceSettings.MQTTTopic = "";
      this.deviceSettings.MQTTPort = -1;
      */
    }

    this.ledcontrolService.applyDeviceSettings(this.deviceConfig!).pipe(
      switchMap(() => this.ledcontrolService.getDeviceSettings())
    ).subscribe(res => {
      this.deviceConfig = res;
    });
  }

  onAddressChanged(event: any) {
    let deviceAddress = event.target.value as string
    if (deviceAddress.length > 0) {
      console.log("onAddressChanged: Add new device: " + event.target.value)
      this.ledcontrolService.setDevice({ Name: "Unknown", Address: deviceAddress })
      this.ledcontrolService.getDeviceSettings().subscribe({
        next: (res) => {
          if (res != null) {
            console.log("Succesful connected to " + res.SensorID)
            let newDevice: Device = { Name: res.SensorID, Address: event.target.value }
            this.deviceConfig = res;
            this.ledcontrolService.setDevice(newDevice)
            let foundDevice = this.findDevice(newDevice.Name)
            if (foundDevice == null) {
              this.localStorage.readSettings().then(newSettings => {
                // remove other device with same name
                newSettings.KnownDevices = this.removeDevice(newSettings.KnownDevices, newDevice.Name)
                 
                newSettings.KnownDevices.push(newDevice)
                newSettings.CurrentDevice = newDevice
                this.connectedDevice = Object.assign({}, newDevice)
                console.warn('add device: ' + JSON.stringify(newDevice))
                this.localStorage.writeSettings(newSettings)
                this.settings = newSettings
              })
            } else {

              this.localStorage.readSettings().then(newSettings => {

                // remove other device with same IP address
                newSettings.KnownDevices.forEach(oldDevice => {
                  if (newDevice.Address === oldDevice.Address) {
                    newSettings.KnownDevices = this.removeDevice(newSettings.KnownDevices, oldDevice.Name)
                  }
                })
                const index = newSettings.KnownDevices.indexOf(newDevice, 0);
                if (index <= -1) {
                  newSettings.KnownDevices.push(newDevice)
                  console.warn("Added changed device: " + newDevice.Name + "/" + newDevice.Address)
                }

                newSettings.CurrentDevice = newDevice;
                console.warn('changed device: ' + JSON.stringify(newDevice))
                this.localStorage.writeSettings(newSettings)
                this.settings = newSettings
              })
            }
          } else { // todo improve
            console.error('Failed to connect to : ' + deviceAddress)
          }
        },
        error: (error) => {
          console.error('Failed to connect to : ' + deviceAddress + ' ' + error)
          throw error
        }
      });
    }
  }

  removeDevice(oldDevices: Device[], name: String) {
    let newKnownDevices: Device[] = []
    oldDevices.forEach(oldDevice => {
      console.log(oldDevice)
      if (oldDevice.Name !== name) {
        newKnownDevices.push(oldDevice)
      } else {
        console.warn('Removed device: ' + name)
      }
    })
    return newKnownDevices
  }

  public alertButtons = [
    {
      text: 'No',
      cssClass: 'alert-button-cancel',
    },
    {
      text: 'Yes',
      cssClass: 'alert-button-confirm',
      handler: () => {
        this.resetWiFi();
      },
    },
  ];

  private findDevice(name: string) {

    for (let i = 0; i < this.localStorage.settings!.KnownDevices.length; i++) {
      if (this.localStorage.settings!.KnownDevices[i].Name == name) {
        console.log("found device: " + JSON.stringify(this.localStorage.settings!))
        return this.localStorage.settings!.KnownDevices[i]
      }
    }
    console.warn("did not find device: " + JSON.stringify(name))
    return null
  }



}
