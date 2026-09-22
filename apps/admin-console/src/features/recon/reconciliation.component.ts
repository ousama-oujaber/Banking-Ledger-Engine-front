import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ble-reconciliation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reconciliation">
      <h2>Reconciliation Dashboard</h2>
      <p>Settlement batches, reconciliation cases, and discrepancy resolution.</p>
    </div>
  `,
})
export class ReconciliationComponent {}
