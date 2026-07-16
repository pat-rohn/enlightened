import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { SunriseComponent } from '../sunrise/sunrise.component';

@Component({
  standalone: false,
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements ViewWillEnter {
  @ViewChild(SunriseComponent) private sunrise?: SunriseComponent;
  private firstEnter = true;

  // Ionic caches tab pages, so ngOnInit only runs once. Refresh on every
  // re-entry — the current device may have changed on the Settings tab.
  ionViewWillEnter(): void {
    if (this.firstEnter) {
      this.firstEnter = false; // initial load is handled by the component's ngOnInit
      return;
    }
    this.sunrise?.clickedRefresh();
  }
}
