import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NEVER, of, throwError } from 'rxjs';

import { LedDetailComponent } from './led-detail.component';
import { LedcontrolService } from '../services/ledcontrol.service';
import { LocalstorageService } from '../services/localstorage.service';

describe('LedDetailComponent', () => {
  let component: LedDetailComponent;
  let fixture: ComponentFixture<LedDetailComponent>;
  let ledSvc: jasmine.SpyObj<LedcontrolService>;

  beforeEach(() => {
    ledSvc = jasmine.createSpyObj<LedcontrolService>('LedcontrolService', [
      'saveStatus', 'getDeviceSettings', 'getLedStatus',
      'setDevice', 'pressButton', 'saveDeviceSettings',
    ]);
    // onRefresh() runs during ngOnInit — return an empty result so it completes fast.
    ledSvc.getDeviceSettings.and.returnValue(of(null as any));
    ledSvc.getLedStatus.and.returnValue(of(null as any));
    ledSvc.saveStatus.and.returnValue(of({} as any));

    const storageSvc = jasmine.createSpyObj<LocalstorageService>('LocalstorageService', ['readSettings']);
    storageSvc.readSettings.and.returnValue(Promise.resolve({
      CurrentDevice: { Name: 'test', Address: '1.2.3.4' },
      KnownDevices: [{ Name: 'test', Address: '1.2.3.4' }],
    } as any));

    TestBed.configureTestingModule({
      declarations: [LedDetailComponent],
      providers: [
        { provide: LedcontrolService, useValue: ledSvc },
        { provide: LocalstorageService, useValue: storageSvc },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(LedDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // A burst of slider moves inside the debounce window collapses to a single write.
  it('coalesces rapid saves into one request', fakeAsync(() => {
    component.ngOnInit();
    tick(300);                       // flush the ngOnInit refresh
    ledSvc.saveStatus.calls.reset();

    component.onSave();
    component.onSave();              // second call inside the 300ms debounce window
    tick(300);

    expect(ledSvc.saveStatus).toHaveBeenCalledTimes(1);
  }));

  // switchMap cancels an in-flight save when a newer one arrives — the last write wins.
  it('supersedes an in-flight save with the newer one', fakeAsync(() => {
    component.ngOnInit();
    tick(300);
    ledSvc.saveStatus.calls.reset();
    ledSvc.saveStatus.and.returnValues(NEVER as any, of({} as any));

    component.onSave();
    tick(300);                       // request 1 in flight (never completes)
    component.onSave();
    tick(300);                       // cancels request 1, request 2 completes

    expect(ledSvc.saveStatus).toHaveBeenCalledTimes(2);
  }));

  // A failed save must not kill the save pipeline — later saves still go out.
  it('keeps saving after a save request errored', fakeAsync(() => {
    component.ngOnInit();
    tick(300);
    ledSvc.saveStatus.calls.reset();
    ledSvc.saveStatus.and.returnValues(
      throwError(() => new Error('device down')) as any,
      of({} as any),
    );

    component.onSave();
    tick(300);                       // request 1 errors
    component.onSave();
    tick(300);                       // request 2 must still be attempted

    expect(ledSvc.saveStatus).toHaveBeenCalledTimes(2);
  }));
});
