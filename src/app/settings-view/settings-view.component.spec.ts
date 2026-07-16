import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { of, throwError } from 'rxjs';

import { SettingsViewComponent } from './settings-view.component';
import { LedcontrolService } from '../services/ledcontrol.service';
import { LocalstorageService } from '../services/localstorage.service';

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;
  let ledSvc: jasmine.SpyObj<LedcontrolService>;
  let storageSvc: jasmine.SpyObj<LocalstorageService>;

  const device = { Name: 'test', Address: '1.2.3.4' };

  beforeEach(() => {
    ledSvc = jasmine.createSpyObj<LedcontrolService>('LedcontrolService', [
      'getDeviceSettings', 'applyDeviceSettings', 'restartDevice', 'setDevice',
    ]);
    ledSvc.getDeviceSettings.and.returnValue(of({ SensorID: 'test' } as any));

    storageSvc = jasmine.createSpyObj<LocalstorageService>(
      'LocalstorageService',
      ['readSettings', 'writeSettings'],
      { settings: { CurrentDevice: device, KnownDevices: [device] } as any },
    );
    storageSvc.readSettings.and.returnValue(Promise.resolve({
      CurrentDevice: device,
      KnownDevices: [device],
    } as any));
    storageSvc.writeSettings.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      declarations: [SettingsViewComponent],
      providers: [
        { provide: LedcontrolService, useValue: ledSvc },
        { provide: LocalstorageService, useValue: storageSvc },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(SettingsViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // 10.2: the returned Promise must resolve only after the refetch finished,
  // so pull-to-refresh spinners don't dismiss early.
  it('clickedRefreshDevice resolves after the config arrived', async () => {
    await component.clickedRefreshDevice();

    expect(component.deviceConfig).toEqual({ SensorID: 'test' } as any);
    expect(component.enableSave).toBeTrue();
  });

  // 10.4: a failed refresh must keep the previous config instead of blanking the form.
  it('keeps the previous device config when the refresh fails', async () => {
    const previous = { SensorID: 'previous' } as any;
    component.deviceConfig = previous;
    ledSvc.getDeviceSettings.and.returnValue(throwError(() => new Error('down')));

    await component.clickedRefreshDevice();

    expect(component.deviceConfig).toBe(previous);
    expect(component.enableSave).toBeTrue();
  });

  // 10.3: selecting a known device persists it via writeSettings.
  it('persists the device selection', async () => {
    component.settings = { CurrentDevice: device, KnownDevices: [device] } as any;
    component.connectedDevice = { ...device };

    await component.onSelect();

    expect(storageSvc.writeSettings).toHaveBeenCalledWith(
      jasmine.objectContaining({ CurrentDevice: device }));
  });

  // 10.3: an unknown selection must not fall back to an empty device.
  it('ignores selection of an unknown device', async () => {
    component.settings = { CurrentDevice: device, KnownDevices: [device] } as any;
    component.connectedDevice = { Name: 'ghost', Address: '9.9.9.9' };

    await component.onSelect();

    expect(storageSvc.writeSettings).not.toHaveBeenCalled();
    expect(component.settings.CurrentDevice).toEqual(device);
  });
});
