import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AccountResponse } from '@ble-frontend/api-client';

@Component({
  selector: 'ble-account-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="account-table">
      <h3>Accounts</h3>
      <p *ngIf="loading()">Loading accounts...</p>
      <table *ngIf="!loading()">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Status</th>
            <th>Balance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let account of accounts()">
            <td>{{ account.id }}</td>
            <td>{{ account.type }}</td>
            <td>{{ account.currency }}</td>
            <td>
              <span [ngClass]="'status-' + (account.status || '').toLowerCase()">
                {{ account.status }}
              </span>
            </td>
            <td>{{ account.derivedBalance }} {{ account.currency }}</td>
            <td>
              <button (click)="freeze(account.id)">Freeze</button>
              <button (click)="close(account.id)">Close</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .account-table { padding: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #ddd; }
    .status-frozen { color: orange; font-weight: bold; }
    .status-closed { color: red; }
    .status-active { color: green; }
    button { margin-right: 0.25rem; padding: 0.25rem 0.5rem; }
  `]
})
export class AccountTableComponent {
  accounts = signal<AccountResponse[]>([]);
  loading = signal(false);

  constructor() {
    this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    try {
      // Uses OpenAPI fetch client with interceptors for auth headers
      const { OpenAPI, getAccount } = await import('@ble-frontend/api-client');
      // TODO: Get customerId from JWT claims
      const customerId = 'customer-current';
      const result = await getAccount({ id: customerId });
      this.accounts.set([result]);
    } catch (error) {
      console.error('Failed to load accounts', error);
    } finally {
      this.loading.set(false);
    }
  }

  freeze(accountId: string): void {
    // POST /api/v1/accounts/{accountId}/freeze
    // Requirement: FR-OPS-ACC-01 — requires mandatory reason
  }

  close(accountId: string): void {
    // POST /api/v1/accounts/{accountId}/close
    // Requirement: FR-OPS-ACC-02 — zero balance invariant check
  }
}
