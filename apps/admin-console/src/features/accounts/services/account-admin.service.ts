import { Injectable, signal, computed } from '@angular/core';
import type { AccountResponse, MoneyDto } from '@ble-frontend/api-client';

@Injectable({ providedIn: 'root' })
export class AccountAdminService {
  // Primary State Signals
  readonly accounts = signal<AccountResponse[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter Signals
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('ALL');
  readonly typeFilter = signal<string>('ALL');
  readonly currencyFilter = signal<string>('ALL');

  // Sorting Signals
  readonly sortBy = signal<string>('id');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');

  // Pagination Signals
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Computed Selectors
  readonly hasActiveFilters = computed<boolean>(() => {
    return (
      this.searchQuery().trim().length > 0 ||
      this.statusFilter() !== 'ALL' ||
      this.typeFilter() !== 'ALL' ||
      this.currencyFilter() !== 'ALL'
    );
  });

  readonly filteredAccounts = computed<AccountResponse[]>(() => {
    const list = this.accounts();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const currency = this.currencyFilter();

    return list.filter((acc) => {
      // Search matching ID, Owner ID, or Label
      if (query.length > 0) {
        const idMatch = (acc.id || '').toLowerCase().includes(query);
        const ownerMatch = (acc.ownerId || '').toLowerCase().includes(query);
        const labelMatch = (acc.label || '').toLowerCase().includes(query);
        if (!idMatch && !ownerMatch && !labelMatch) {
          return false;
        }
      }

      // Status filter
      if (status !== 'ALL' && (acc.status || '').toUpperCase() !== status.toUpperCase()) {
        return false;
      }

      // Type filter
      if (type !== 'ALL' && (acc.type || '').toUpperCase() !== type.toUpperCase()) {
        return false;
      }

      // Currency filter
      if (currency !== 'ALL' && (acc.currency || '').toUpperCase() !== currency.toUpperCase()) {
        return false;
      }

      return true;
    });
  });

  readonly sortedAccounts = computed<AccountResponse[]>(() => {
    const list = [...this.filteredAccounts()];
    const field = this.sortBy();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      if (field === 'balance') {
        const balA = this.getBalanceAmount(a);
        const balB = this.getBalanceAmount(b);
        return (balA - balB) * direction;
      }

      let valA: string = '';
      let valB: string = '';

      switch (field) {
        case 'id':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'ownerId':
          valA = a.ownerId || '';
          valB = b.ownerId || '';
          break;
        case 'type':
          valA = a.type || '';
          valB = b.type || '';
          break;
        case 'currency':
          valA = a.currency || '';
          valB = b.currency || '';
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        default:
          valA = a.id || '';
          valB = b.id || '';
      }

      return valA.localeCompare(valB) * direction;
    });
  });

  readonly totalCount = computed<number>(() => this.filteredAccounts().length);

  readonly totalPages = computed<number>(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly paginatedAccounts = computed<AccountResponse[]>(() => {
    const sorted = this.sortedAccounts();
    const page = this.currentPage();
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    return sorted.slice(startIndex, startIndex + size);
  });

  readonly startRecordIndex = computed<number>(() => {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endRecordIndex = computed<number>(() => {
    return Math.min(this.totalCount(), this.currentPage() * this.pageSize());
  });

  // State Mutators
  setAccounts(accounts: AccountResponse[]): void {
    this.accounts.set(accounts);
    this.ensureValidPage();
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  setTypeFilter(type: string): void {
    this.typeFilter.set(type);
    this.currentPage.set(1);
  }

  setCurrencyFilter(currency: string): void {
    this.currencyFilter.set(currency);
    this.currentPage.set(1);
  }

  toggleSort(field: string): void {
    if (this.sortBy() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(field);
      this.sortDirection.set('asc');
    }
  }

  setPage(page: number): void {
    const maxPage = this.totalPages();
    const sanitized = Math.max(1, Math.min(page, maxPage));
    this.currentPage.set(sanitized);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.typeFilter.set('ALL');
    this.currencyFilter.set('ALL');
    this.currentPage.set(1);
  }

  // Authoritative Balance and Domain Invariants (BR-F01, BR-F02, BR-F05)
  getBalanceAmount(account: AccountResponse): number {
    const derived = account.derivedBalance || account.balance;
    if (typeof derived === 'object' && derived !== null) {
      return (derived as MoneyDto).amount ?? 0;
    }
    if (typeof derived === 'number') {
      return derived;
    }
    if (typeof derived === 'string') {
      const parsed = parseFloat(derived);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  formatBalance(account: AccountResponse): string {
    const amount = this.getBalanceAmount(account);
    const currency = account.currency || 'EUR';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  isZeroBalance(account: AccountResponse): boolean {
    const amount = this.getBalanceAmount(account);
    return Math.abs(amount) < 0.000001;
  }

  // Async API Loader with Fallback Grace
  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { apiClient, listCustomerAccounts } = await import('@ble-frontend/api-client');

      try {
        // Preferred Operator Endpoint: GET /api/v1/accounts
        const accounts = await apiClient.get<AccountResponse[]>('/api/v1/accounts');
        if (Array.isArray(accounts)) {
          this.accounts.set(accounts);
          this.ensureValidPage();
          return;
        }
      } catch (err) {
        // Fallback to customer accounts if admin route requires specific query
        try {
          const fallback = await listCustomerAccounts({ id: 'current' });
          if (Array.isArray(fallback)) {
            this.accounts.set(fallback);
            this.ensureValidPage();
            return;
          }
        } catch {
          // If network / backend unavailable, preserve current accounts or record error
          throw err;
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to retrieve accounts from server.';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  private ensureValidPage(): void {
    const max = this.totalPages();
    if (this.currentPage() > max) {
      this.currentPage.set(max);
    }
  }
}
