import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { skip, switchMap, takeUntil } from 'rxjs/operators';
import { DeviceSettings, Settings, Device } from '../settings';
import { LocalstorageService } from '../services/localstorage.service'
import { LedcontrolService } from '../services/ledcontrol.service';
import { ActivatedRoute } from '@angular/router';

const DEFAULT_WIFI_SSID = 'Enlighted';
const DEFAULT_WIFI_PASSWORD = 'enlighten-me';

@Component({
  standalone: false,
  selector: 'app-settings-view',
  templateUrl: './settings-view.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./settings-view.component.scss'],
})
export class SettingsViewComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  settings: Settings = this.localStorage.settings;
  connectedDevice: Device = { Name: "init", Address: "0" }
  deviceConfig?: DeviceSettings;
  enableSave = true;

  readonly fieldDefs: Array<{
    key: keyof DeviceSettings;
    label: string;
    type: 'text' | 'number' | 'password' | 'checkbox';
    showWhen?: { field: keyof DeviceSettings; greaterThan?: number };
  }> = [
    { key: 'SensorID',          label: 'Device Name',       type: 'text' },
    { key: 'ServerAddress',     label: 'ServerAddress',     type: 'text' },
    { key: 'WiFiName',          label: 'WiFiName',          type: 'text' },
    { key: 'WiFiPassword',      label: 'WiFiPassword',      type: 'password' },
    { key: 'ShowWebpage',       label: 'ShowWebpage',       type: 'checkbox' },
    { key: 'IsConfigured',      label: 'IsConfigured',      type: 'checkbox' },
    { key: 'IsOfflineMode',     label: 'IsOfflineMode',     type: 'checkbox' },
    { key: 'Button1',           label: 'Button1',           type: 'number' },
    { key: 'Button2',           label: 'Button2',           type: 'number' },
    { key: 'Button2GetURL',     label: 'Button2GetURL',     type: 'text',    showWhen: { field: 'Button2', greaterThan: 0 } },
    { key: 'NumberOfLEDs',      label: 'NumberOfLEDs',      type: 'number' },
    { key: 'LEDPin',            label: 'LEDPin',            type: 'number',  showWhen: { field: 'NumberOfLEDs', greaterThan: 0 } },
    { key: 'FindSensors',       label: 'FindSensors',       type: 'checkbox' },
    { key: 'DhtPin',            label: 'DhtPin',            type: 'number',  showWhen: { field: 'FindSensors' } },
    { key: 'SerialRX',          label: 'SerialRX',          type: 'number',  showWhen: { field: 'FindSensors' } },
    { key: 'SerialTX',          label: 'SerialTX',          type: 'number',  showWhen: { field: 'FindSensors' } },
    { key: 'WindSensorPin',     label: 'WindSensorPin',     type: 'number' },
    { key: 'RainfallSensorPin', label: 'RainfallSensorPin', type: 'number' },
    { key: 'UseMQTT',           label: 'UseMQTT',           type: 'checkbox' },
    { key: 'MQTTPort',          label: 'MQTTPort',          type: 'number',  showWhen: { field: 'UseMQTT' } },
    { key: 'MQTTTopic',         label: 'MQTTTopic',         type: 'text',    showWhen: { field: 'UseMQTT' } },
  ];

  isFieldVisible(field: { showWhen?: { field: keyof DeviceSettings; greaterThan?: number } }): boolean {
    if (!field.showWhen || !this.deviceConfig) return true;
    const val = (this.deviceConfig as any)[field.showWhen.field];
    if (field.showWhen.greaterThan !== undefined) return (val as number) > field.showWhen.greaterThan;
    return !!val;
  }

  constructor(
    private localStorage: LocalstorageService,
    private ledcontrolService: LedcontrolService,
    private activeRoute: ActivatedRoute) {
    this.activeRoute.params.pipe(skip(1), takeUntil(this.destroy$)).subscribe(params => {
      console.log(params["id"]);
      this.clickedRefreshDevice();
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
    if (this.deviceConfig?.ServerAddress && !this.isValidUrl(this.deviceConfig.ServerAddress)) {
      console.error('Invalid ServerAddress URL: ' + this.deviceConfig.ServerAddress);
      this.enableSave = true;
      return;
    }
    if (this.deviceConfig?.Button2GetURL && !this.isValidUrl(this.deviceConfig.Button2GetURL)) {
      console.error('Invalid Button2GetURL: ' + this.deviceConfig.Button2GetURL);
      this.enableSave = true;
      return;
    }
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
      this.deviceConfig.WiFiName = DEFAULT_WIFI_SSID;
      this.deviceConfig.WiFiPassword = DEFAULT_WIFI_PASSWORD;
      this.deviceConfig.IsOfflineMode = true;
    }

    this.ledcontrolService.applyDeviceSettings(this.deviceConfig!).pipe(
      switchMap(() => this.ledcontrolService.getDeviceSettings())
    ).subscribe(res => {
      this.deviceConfig = res;
    });
  }

  private isValidDeviceAddress(address: string): boolean {
    // Accept IPv4, IPv4:port, or simple hostnames. Reject anything with whitespace or URL schemes.
    return /^[a-zA-Z0-9._-]+(:\d{1,5})?$/.test(address);
  }

  private isValidUrl(url: string): boolean {
    // Accept only http:// and https:// URLs — reject empty strings, bare IPs, and other schemes.
    if (!url) return true; // optional field
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  onAddressChanged(event: any) {
    const deviceAddress = (event.target.value as string).trim();
    if (deviceAddress.length > 0 && this.isValidDeviceAddress(deviceAddress)) {
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
