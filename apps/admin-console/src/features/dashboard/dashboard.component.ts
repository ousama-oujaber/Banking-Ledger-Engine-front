import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ble-dashboard',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="dashboard">
      <nav>Admin Console</nav>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class DashboardComponent {}
