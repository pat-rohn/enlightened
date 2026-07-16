import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { SunriseComponent } from './sunrise.component';
import { LedcontrolService } from '../services/ledcontrol.service';
import { LocalstorageService } from '../services/localstorage.service';

describe('SunriseComponent', () => {
  let component: SunriseComponent;
  let fixture: ComponentFixture<SunriseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SunriseComponent],
      providers: [
        { provide: LedcontrolService, useValue: {} },
        { provide: LocalstorageService, useValue: {} },
        { provide: ActivatedRoute, useValue: { params: of({}) } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(SunriseComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
