import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ble-rules-matrix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rules-matrix">
      <h2>Rules Engine Management</h2>
      <p>Fee rules, interest rules, limit policies with CRUD operations.</p>
    </div>
  `,
})
export class RulesMatrixComponent {}
