import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ble-audit-explorer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audit-explorer">
      <h2>Audit Trail Explorer</h2>
      <p>Query immutable audit events with filters: actorId, eventType, resourceId, date range.</p>
    </div>
  `,
})
export class AuditExplorerComponent {}
