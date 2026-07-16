import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { SettingsViewComponent } from './settings-view.component';
import { LedcontrolService } from '../services/ledcontrol.service';
import { LocalstorageService } from '../services/localstorage.service';

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SettingsViewComponent],
      providers: [
        { provide: LedcontrolService, useValue: {} },
        { provide: LocalstorageService, useValue: {} },
        { provide: ActivatedRoute, useValue: { params: of({}) } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(SettingsViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
