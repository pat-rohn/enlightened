import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { LedDetailComponent } from '../led-detail/led-detail.component';

@Component({
  standalone: false,
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page implements ViewWillEnter {
  @ViewChild(LedDetailComponent) private led?: LedDetailComponent;
  private firstEnter = true;

  // Ionic caches tab pages, so ngOnInit only runs once. Refresh on every
  // re-entry — the current device may have changed on the Settings tab.
  ionViewWillEnter(): void {
    if (this.firstEnter) {
      this.firstEnter = false; // initial load is handled by the component's ngOnInit
      return;
    }
    this.led?.onRefresh();
  }
}
