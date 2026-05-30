import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Settings, Device } from '../settings';
import { DEFAULT_LED_STATUS } from '../ledstatus-mockup';
import { LedcontrolService } from './ledcontrol.service'


@Injectable({
  providedIn: 'root'
})
export class LocalstorageService {

  settingKey = "settings-new"
  settings: Settings = {
    Ledstatus: DEFAULT_LED_STATUS,
    CurrentDevice: { Name: "Default", Address: "192.168.4.1" },
    KnownDevices: [{ Name: "Default", Address: "192.168.4.1" }]
  };

  constructor(
    private ledControlService: LedcontrolService,
  ) {
    console.log("Storage Service");
  }

  async readSettings() {
    console.log("read settings");
    console.log(JSON.stringify(this.settings));
    const { value } = await Preferences.get({ key: this.settingKey })
    if (value != null) {
      let settingsStr = value.toString();
      this.settings = JSON.parse(settingsStr);
      console.log("Replace settings" + settingsStr);
    }

    //console.log(JSON.stringify(this.settings));
    if (this.settings.KnownDevices == null) {
      this.settings.KnownDevices = [{ Name: "Default", Address: "192.168.4.1" }];
    }
    console.log("get settings" + JSON.stringify(this.settings.CurrentDevice));

    return this.settings;
    //console.log(JSON.stringify(this.settings));

  }

  async writeSettings(settings: Settings) {
    console.log("write settings:" + JSON.stringify(settings));
    await Preferences.set({ key: this.settingKey, value: JSON.stringify(settings) })
    this.settings = settings;
    this.ledControlService.setDevice(settings.CurrentDevice);
  }

  getSettings() {
    return this.settings;
  }

}
