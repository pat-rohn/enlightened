import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
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

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    })
  };

  constructor(private http: HttpClient, public toastController: ToastController) {
    this.ledStatus = DEFAULT_LED_STATUS;
    console.log('led message ' + this.ledStatus.message);
  }

  public setDevice(currentDevice: Device) {
    this.currentDevice = currentDevice;
    console.log('ledcontrol:set device' + JSON.stringify(this.currentDevice));
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
    return this.http.post(url, ledstatus, this.httpOptions).pipe(
      timeout(3000),
      tap(_ => console.log(`updated led ` + ledstatus.Message)),
      catchError(this.handleError<any>('saveStatus'))
    );
  }

  pressButton(nr: string): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/button" + nr
    console.log('Button:' + nr + 'pressed');

    return this.http.get<any>(url, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
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
    return this.http.put(url, deviceSettings, this.httpOptions).pipe(
      catchError(this.handleError<any>('Apply Device Settings'))
    );
  }

  restartDevice(): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/restart"
    console.log('restart:' + url);
    return this.http.get(url, this.httpOptions).pipe(
      catchError(this.handleError<any>('Restart'))
    );
  }

  // no restart of controller
  saveDeviceSettings(deviceSettings: DeviceSettings): Observable<any> {
    const url = "http://" + this.currentDevice?.Address + "/api/config"
    console.log('set device settings to :' + url);
    console.log(`Apply: ` + JSON.stringify(deviceSettings))
    return this.http.put(url, deviceSettings, this.httpOptions).pipe(
      catchError(this.handleError<any>('Apply Device Settings'))
    );
  }


  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      console.error(error);

      console.log(`${operation} failed: ${error.message}`);
      this.presentToast(`${operation} failed: ${error.message}`);
      return of(result as T);
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
