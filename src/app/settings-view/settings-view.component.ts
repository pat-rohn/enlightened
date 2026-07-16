import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DeviceSettings, Settings, Device } from '../settings';
import { LocalstorageService } from '../services/localstorage.service'
import { LedcontrolService } from '../services/ledcontrol.service';
import { AlertController } from '@ionic/angular';

const DEFAULT_WIFI_SSID = 'Enlighted';
const DEFAULT_WIFI_PASSWORD = 'enlighten-me';

@Component({
  standalone: false,
  selector: 'app-settings-view',
  templateUrl: './settings-view.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./settings-view.component.scss'],
})
export class SettingsViewComponent implements OnInit {
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
    private alertController: AlertController,
    private cdr: ChangeDetectorRef) {
  }

  async ngOnInit() {
    console.log("init view comp");
    const res = await this.localStorage.readSettings();
    this.settings = res;
    this.ledcontrolService.setDevice(res.CurrentDevice);
    this.connectedDevice = Object.assign({}, res.CurrentDevice);
    this.cdr.markForCheck();
    try {
      const config = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (config != null) {
        this.deviceConfig = config;
      }
    } catch (err) {
      console.error(err);
    }
    this.cdr.markForCheck();
  }

  async onSelect() {
    const dev = this.findDevice(this.connectedDevice.Name)
    if (dev == null) {
      console.error("onSelect: unknown device " + this.connectedDevice.Name)
      return;
    }
    this.settings.CurrentDevice = Object.assign({}, dev)
    console.log("onSelect: current Device " + JSON.stringify(this.connectedDevice))
    // writeSettings persists the selection and calls setDevice() itself.
    await this.localStorage.writeSettings(this.settings)
    await this.clickedRefreshDevice()
  }

  compareDevice(o1: Device, o2: Device) {
    return o1.Name && o2.Name ? o1.Name === o2.Name : o1.Name === o2.Name;
  }

  handleRefresh(event: any) {
    // Refresh the *current* device, not a possibly half-typed new address.
    this.ledcontrolService.setDevice(this.settings.CurrentDevice)
    this.clickedRefreshDevice().then(_ => {
      console.log("handle Refresher complete")
      event.target.complete()
      this.cdr.markForCheck();
    })
  };


  async clickedRefreshDevice() {
    console.log("Disable Save")
    this.enableSave = false;
    this.cdr.markForCheck();
    try {
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (res != null) {
        this.deviceConfig = res;
      }
    } catch (err) {
      console.log(err);
    }
    this.enableSave = true;
    console.log("Enable Save")
    this.cdr.markForCheck();
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
    try {
      await firstValueFrom(this.ledcontrolService.applyDeviceSettings(this.deviceConfig!));
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (res != null) {
        this.deviceConfig = res;
      }
    } catch (err) {
      console.error(err);
    }
    this.enableSave = true;
    this.cdr.markForCheck();
  }

  async clickedRestart() {
    console.log("Restart");
    this.enableSave = false;
    this.cdr.markForCheck();
    console.log(JSON.stringify(this.deviceConfig));
    try {
      await firstValueFrom(this.ledcontrolService.restartDevice());
    } catch (err) {
      // The restart request itself often dies mid-reboot — that's expected.
      console.error(err);
    }
    // The device is unreachable while it reboots; wait, then retry the refetch
    // a few times instead of blanking the form on the first failure.
    await this.delay(4000);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
        if (res != null) {
          this.deviceConfig = res;
          break;
        }
      } catch (err) {
        console.error(err);
        await this.delay(2000);
      }
    }
    this.enableSave = true;
    this.cdr.markForCheck();
  }

  async resetWiFi() {
    if (this.deviceConfig == null) {
      return;
    }
    this.deviceConfig.IsConfigured = false;
    this.deviceConfig.ServerAddress = "http://localhost:3000";
    this.deviceConfig.WiFiName = DEFAULT_WIFI_SSID;
    this.deviceConfig.WiFiPassword = DEFAULT_WIFI_PASSWORD;
    this.deviceConfig.IsOfflineMode = true;

    try {
      await firstValueFrom(this.ledcontrolService.applyDeviceSettings(this.deviceConfig));
      const res = await firstValueFrom(this.ledcontrolService.getDeviceSettings());
      if (res != null) {
        this.deviceConfig = res;
      }
    } catch (err) {
      console.error(err);
    }
    this.cdr.markForCheck();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            const newDevice: Device = { Name: res.SensorID, Address: event.target.value }
            this.deviceConfig = res;
            this.cdr.markForCheck();
            this.ledcontrolService.setDevice(newDevice)
            const foundDevice = this.findDevice(newDevice.Name)
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
                this.cdr.markForCheck();
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
                this.cdr.markForCheck();
              })
            }
          } else { // todo improve
            console.error('Failed to connect to : ' + deviceAddress)
          }
        },
        error: (error) => {
          console.error('Failed to connect to : ' + deviceAddress + ' ' + error)
        }
      });
    }
  }

  async confirmRemoveDevice(device: Device) {
    const alert = await this.alertController.create({
      header: 'Remove device?',
      message: 'This will remove "' + device.Name + '" (' + device.Address + ') from the list.',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Yes',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.removeKnownDevice(device);
          },
        },
      ],
    });
    await alert.present();
  }

  private async removeKnownDevice(device: Device) {
    const newSettings = await this.localStorage.readSettings();
    newSettings.KnownDevices = this.removeDevice(newSettings.KnownDevices, device.Name);
    if (newSettings.KnownDevices.length === 0) {
      newSettings.KnownDevices = [{ Name: "Default", Address: "192.168.4.1" }];
    }
    if (newSettings.CurrentDevice == null || newSettings.CurrentDevice.Name === device.Name) {
      newSettings.CurrentDevice = newSettings.KnownDevices[0];
      this.connectedDevice = Object.assign({}, newSettings.CurrentDevice);
    }
    await this.localStorage.writeSettings(newSettings);
    this.settings = newSettings;
    this.cdr.markForCheck();
  }

  removeDevice(oldDevices: Device[], name: string) {
    const newKnownDevices: Device[] = []
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
