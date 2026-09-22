import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ble-hold-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hold-management">
      <h2>Authorization Holds</h2>
      <p>Place holds via POST /api/v1/holds, view active holds, release or capture.</p>
    </div>
  `,
})
export class HoldManagementComponent {}
