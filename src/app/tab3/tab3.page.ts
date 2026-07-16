import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { SettingsViewComponent } from '../settings-view/settings-view.component';

@Component({
  standalone: false,
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['tab3.page.scss']
})
export class Tab3Page implements ViewWillEnter {
  @ViewChild(SettingsViewComponent) private view?: SettingsViewComponent;
  private firstEnter = true;

  // Ionic caches tab pages, so ngOnInit only runs once. Refetch the device
  // config on every re-entry so the form reflects the device's live state.
  ionViewWillEnter(): void {
    if (this.firstEnter) {
      this.firstEnter = false; // initial load is handled by the component's ngOnInit
      return;
    }
    this.view?.clickedRefreshDevice();
  }
}
