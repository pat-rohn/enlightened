import { Injectable } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, timeout, tap, switchMap } from 'rxjs/operators';

import { LEDStatus, LEDStatusJSON } from '../ledstatus';
import { DEFAULT_LED_STATUS } from '../ledstatus-mockup';
import { ToastController } from '@ionic/angular';
import { DeviceSettings, Device } from '../settings';


@Injectable({
  providedIn: 'root'
})
export class LedcontrolService {
  currentDevice?: Device;
  ledStatus: LEDStatus;

  // Legacy encoding for OLD firmware (no /api/version): it only exposes a request
  // body as a POST param when the Content-Type is application/x-www-form-urlencoded —
  // the whole JSON body then arrives as the value of a single "body" param. With any
  // other Content-Type the body is dropped, params() == 0, and the firmware silently
  // writes nothing. See BUGS_AND_CAVEATS.md §10.5.
  // NEW firmware reads raw request bodies, is detected via /api/version, and then
  // gets proper application/json requests. It still accepts the legacy encoding, so
  // defaulting to legacy while the probe is in flight is always safe.
  private readonly legacyOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    })
  };
  private readonly jsonOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  // Firmware version of the current device, e.g. "2026-05-29-89634f2".
  // Empty while unknown or when the device runs old firmware.
  firmwareVersion = '';
  // Build date parsed from firmwareVersion. Not used for anything yet.
  firmwareDate?: Date;
  private useRawJson = false;
  private versionProbe: Promise<string> = Promise.resolve('');

  constructor(private http: HttpClient, public toastController: ToastController) {
    this.ledStatus = DEFAULT_LED_STATUS;
    console.log('led message ' + this.ledStatus.message);
  }

  public setDevice(currentDevice: Device) {
    this.currentDevice = currentDevice;
    console.log('ledcontrol:set device' + JSON.stringify(this.currentDevice));
    this.versionProbe = this.probeFirmwareVersion();
  }

  // Resolves to the firmware version of the current device ('' for old firmware).
  public getFirmwareVersion(): Promise<string> {
    return this.versionProbe;
  }

  private probeFirmwareVersion(): Promise<string> {
    const url = "http://" + this.currentDevice?.Address + "/api/version";
    this.firmwareVersion = '';
    this.firmwareDate = undefined;
    this.useRawJson = false;
    return firstValueFrom(this.http.get(url, { responseType: 'text' }).pipe(timeout(2000)))
      .then(version => {
        // Expected form: "YYYY-MM-DD-<githash>". Anything else (e.g. a catch-all
        // HTML page) must not switch the request format.
        const match = version.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match == null) {
          console.warn('unexpected /api/version answer: ' + version);
          return '';
        }
        this.firmwareVersion = version.trim();
        this.firmwareDate = new Date(+match[1], +match[2] - 1, +match[3]);
        this.useRawJson = true;
        console.log('firmware ' + this.firmwareVersion + ' — using raw JSON requests');
        return this.firmwareVersion;
      })
      .catch(() => {
        console.log('no /api/version — old firmware, using legacy request format');
        return '';
      });
  }

  // Request options for body-carrying requests, per detected firmware.
  private get writeOptions() {
    return this.useRawJson ? this.jsonOptions : this.legacyOptions;
  }

  getLedStatus(): Observable<LEDStatusJSON> {
    const url = "http://" + this.currentDevice?.Address + "/api/led";
    console.log('get led status from:' + url);
    return this.http.get<LEDStatusJSON>(url).pipe(
      tap(_ => console.log('fetched led status')),
      catchError(this.handleError<LEDStatusJSON>('getLedStatus'))
    );
  }

  saveStatus(ledstatus: LEDStatusJSON): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/led"
    console.log('get led status from:' + url);
    console.log(`Save: ` + ledstatus.Message + " mode: " + ledstatus.Mode + " Colors:[" +
      ledstatus.Brightness +
      "," + ledstatus.Red +
      "," + ledstatus.Green +
      "," + ledstatus.Blue +
      "]")
    return this.http.post(url, ledstatus, this.writeOptions).pipe(
      timeout(3000),
      tap(_ => console.log(`updated led ` + ledstatus.Message)),
      catchError(this.handleError<any>('saveStatus'))
    );
  }

  pressButton(nr: string): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/button" + nr
    console.log('Button:' + nr + 'pressed');

    return this.http.get<any>(url).pipe(
      timeout(3000),
      tap(_ => console.log(`updated led `)),
      catchError(this.handleError<any>('pressButton' + nr))
    );
  }


  getDeviceSettings(device?: Device): Observable<DeviceSettings> {
    let url = "http://" + this.currentDevice?.Address + "/api/config";
    if (device != null) {
      url = "http://" + device.Address + "/api/config";
    }
    console.log('get device settings from:' + url);
    return this.http.get<DeviceSettings>(url).pipe(
      timeout(2000),
      tap(_ => console.log('fetched device settings')),
      catchError(this.handleError<DeviceSettings>('Get Device Settings'))
    );
  }

  getTime(): Observable<string> {
    const url = "http://" + this.currentDevice?.Address + "/api/time";
    console.log('get time from:' + url);
    return this.http.get(url, { responseType: 'text' }).pipe(
      timeout(1000),
      tap(_ => console.log('fetched device settings')),
      catchError(this.handleError<string>('Get Time')));
  }

  applyDeviceSettings(deviceSettings: DeviceSettings): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/config"
    console.log('set device settings to :' + url);
    console.log(`Apply: ` + JSON.stringify(deviceSettings))
    return this.http.put(url, deviceSettings, this.writeOptions).pipe(
      catchError(this.handleError<any>('Apply Device Settings'))
    );
  }

  restartDevice(): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/restart"
    console.log('restart:' + url);
    return this.http.get(url).pipe(
      timeout(3000),
      catchError(this.handleError<any>('Restart'))
    );
  }

  // no restart of controller
  saveDeviceSettings(deviceSettings: DeviceSettings): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/config"
    console.log('set device settings to :' + url);
    console.log(`Apply: ` + JSON.stringify(deviceSettings))
    return this.http.put(url, deviceSettings, this.writeOptions).pipe(
      catchError(this.handleError<any>('Apply Device Settings'))
    );
  }


  // Toasts the failure, then rethrows so callers see an error instead of a
  // bogus `undefined` success emission.
  private handleError<T>(operation = 'operation') {
    return (error: any): Observable<T> => {

      console.error(error);

      console.log(`${operation} failed: ${error.message}`);
      this.presentToast(`${operation} failed: ${error.message}`);
      return throwError(() => error);
    };
  }
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 1500
    });
    toast.present();
  }

}
