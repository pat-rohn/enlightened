import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page {

  constructor() {}

}
