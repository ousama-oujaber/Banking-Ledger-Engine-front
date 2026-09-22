import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ble-dlq-ops',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dlq-ops">
      <h2>Dead-Letter Queue Operations</h2>
      <p>Inspect failed outbox events, view payloads, trigger replay or discard.</p>
    </div>
  `,
})
export class DlqOpsComponent {}
