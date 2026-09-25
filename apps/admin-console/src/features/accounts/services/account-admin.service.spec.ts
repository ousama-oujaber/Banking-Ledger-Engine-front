import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountAdminService } from './account-admin.service';
import type { AccountResponse } from '@ble-frontend/api-client';

const mockAccounts: AccountResponse[] = [
  {
    id: 'acc-001',
    ownerId: 'cust-100',
    label: 'Main Operating',
    type: 'CLASSIC',
    currency: 'EUR',
    status: 'ACTIVE',
    derivedBalance: { amount: 15420.5, currency: 'EUR' },
  },
  {
    id: 'acc-002',
    ownerId: 'cust-200',
    label: 'Reserve Treasury',
    type: 'SAVINGS',
    currency: 'USD',
    status: 'FROZEN',
    derivedBalance: { amount: 0.0, currency: 'USD' },
  },
  {
    id: 'acc-003',
    ownerId: 'cust-100',
    label: 'Escrow Vault',
    type: 'ESCROW',
    currency: 'EUR',
    status: 'ACTIVE',
    derivedBalance: { amount: 7500.0, currency: 'EUR' },
  },
  {
    id: 'acc-004',
    ownerId: 'cust-300',
    label: 'Settlement Node',
    type: 'SETTLEMENT',
    currency: 'GBP',
    status: 'CLOSED',
    derivedBalance: { amount: 0.0, currency: 'GBP' },
  },
  {
    id: 'acc-005',
    ownerId: 'cust-400',
    label: 'Fee Income Clearing',
    type: 'CLEARING',
    currency: 'EUR',
    status: 'ACTIVE',
    derivedBalance: { amount: 2310.25, currency: 'EUR' },
  },
];

describe('AccountAdminService (S4-T2 State Management)', () => {
  let service: AccountAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AccountAdminService();
    service.setAccounts(mockAccounts);
  });

  it('should initialize with default pagination and filter signals', () => {
    expect(service.searchQuery()).toBe('');
    expect(service.statusFilter()).toBe('ALL');
    expect(service.typeFilter()).toBe('ALL');
    expect(service.currencyFilter()).toBe('ALL');
    expect(service.sortBy()).toBe('id');
    expect(service.sortDirection()).toBe('asc');
    expect(service.currentPage()).toBe(1);
    expect(service.pageSize()).toBe(10);
    expect(service.totalCount()).toBe(5);
    expect(service.totalPages()).toBe(1);
    expect(service.hasActiveFilters()).toBe(false);
  });

  describe('Filtering Signals', () => {
    it('should filter accounts by partial ID or owner ID case-insensitively', () => {
      service.setSearch('acc-002');
      expect(service.filteredAccounts().length).toBe(1);
      expect(service.filteredAccounts()[0].id).toBe('acc-002');

      service.setSearch('cust-100');
      expect(service.filteredAccounts().length).toBe(2);
      expect(service.filteredAccounts().map((a: AccountResponse) => a.id)).toEqual([
        'acc-001',
        'acc-003',
      ]);
    });

    it('should filter accounts by status', () => {
      service.setStatusFilter('FROZEN');
      expect(service.filteredAccounts().length).toBe(1);
      expect(service.filteredAccounts()[0].id).toBe('acc-002');

      service.setStatusFilter('ACTIVE');
      expect(service.filteredAccounts().length).toBe(3);
    });

    it('should filter accounts by type', () => {
      service.setTypeFilter('SAVINGS');
      expect(service.filteredAccounts().length).toBe(1);
      expect(service.filteredAccounts()[0].type).toBe('SAVINGS');
    });

    it('should filter accounts by currency', () => {
      service.setCurrencyFilter('EUR');
      expect(service.filteredAccounts().length).toBe(3);
      service.setCurrencyFilter('GBP');
      expect(service.filteredAccounts().length).toBe(1);
    });

    it('should combine multiple active filters', () => {
      service.setCurrencyFilter('EUR');
      service.setStatusFilter('ACTIVE');
      service.setTypeFilter('ESCROW');
      expect(service.filteredAccounts().length).toBe(1);
      expect(service.filteredAccounts()[0].id).toBe('acc-003');
      expect(service.hasActiveFilters()).toBe(true);
    });

    it('should reset all filters cleanly and reset page to 1', () => {
      service.setSearch('vault');
      service.setStatusFilter('ACTIVE');
      service.setPage(2);
      expect(service.hasActiveFilters()).toBe(true);

      service.resetFilters();
      expect(service.searchQuery()).toBe('');
      expect(service.statusFilter()).toBe('ALL');
      expect(service.typeFilter()).toBe('ALL');
      expect(service.currencyFilter()).toBe('ALL');
      expect(service.currentPage()).toBe(1);
      expect(service.hasActiveFilters()).toBe(false);
      expect(service.filteredAccounts().length).toBe(5);
    });
  });

  describe('Sorting Signals', () => {
    it('should sort accounts by balance ascending and descending', () => {
      service.toggleSort('balance'); // first click asc
      expect(service.sortBy()).toBe('balance');
      expect(service.sortDirection()).toBe('asc');
      expect(service.sortedAccounts()[0].id).toBe('acc-002'); // 0.00
      expect(service.sortedAccounts()[service.sortedAccounts().length - 1].id).toBe('acc-001'); // 15420.50

      service.toggleSort('balance'); // second click desc
      expect(service.sortDirection()).toBe('desc');
      expect(service.sortedAccounts()[0].id).toBe('acc-001');
    });

    it('should sort accounts by status alphabetically', () => {
      service.toggleSort('status');
      expect(service.sortBy()).toBe('status');
      expect(service.sortedAccounts()[0].status).toBe('ACTIVE');
    });
  });

  describe('Pagination Signals', () => {
    it('should slice paginatedAccounts based on page and pageSize', () => {
      service.setPageSize(2);
      expect(service.totalPages()).toBe(3);
      expect(service.paginatedAccounts().length).toBe(2);
      expect(service.paginatedAccounts()[0].id).toBe('acc-001');
      expect(service.paginatedAccounts()[1].id).toBe('acc-002');

      service.setPage(2);
      expect(service.paginatedAccounts().length).toBe(2);
      expect(service.paginatedAccounts()[0].id).toBe('acc-003');
      expect(service.paginatedAccounts()[1].id).toBe('acc-004');

      service.setPage(3);
      expect(service.paginatedAccounts().length).toBe(1);
      expect(service.paginatedAccounts()[0].id).toBe('acc-005');
    });

    it('should prevent setting invalid page numbers', () => {
      service.setPageSize(2); // total 3 pages
      service.setPage(999);
      expect(service.currentPage()).toBe(3);

      service.setPage(-5);
      expect(service.currentPage()).toBe(1);
    });
  });

  describe('Balance Formatting & Zero-Balance Invariant Check', () => {
    it('should accurately format derived balance with currency and precision', () => {
      expect(service.formatBalance(mockAccounts[0])).toBe('€15,420.50');
      expect(service.formatBalance(mockAccounts[1])).toBe('$0.00');
      expect(service.formatBalance(mockAccounts[3])).toBe('£0.00');
    });

    it('should identify zero balance accounts for closure invariant (BR-F05)', () => {
      expect(service.isZeroBalance(mockAccounts[0])).toBe(false);
      expect(service.isZeroBalance(mockAccounts[1])).toBe(true);
      expect(service.isZeroBalance(mockAccounts[3])).toBe(true);
    });
  });

  describe('Account Lifecycle Mutations (S4-T3)', () => {
    it('should reject freeze if mandatory reason is missing or empty', async () => {
      await expect(service.freezeAccount('acc-001', '')).rejects.toThrow(
        /Mandatory reason required/i,
      );
      await expect(service.freezeAccount('acc-001', '   ')).rejects.toThrow(
        /Mandatory reason required/i,
      );
    });

    it('should successfully freeze an active account and update signal state', async () => {
      const { apiClient } = await import('@ble-frontend/api-client');
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockAccounts[0],
        status: 'FROZEN',
      });

      const updated = await service.freezeAccount('acc-001', 'Suspicious activity AML flag');
      expect(updated.status).toBe('FROZEN');

      const found = service.accounts().find((a) => a.id === 'acc-001');
      expect(found?.status).toBe('FROZEN');
    });

    it('should successfully unfreeze a frozen account and update signal state', async () => {
      const { apiClient } = await import('@ble-frontend/api-client');
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockAccounts[1],
        status: 'ACTIVE',
      });

      const updated = await service.unfreezeAccount('acc-002', 'Verification completed');
      expect(updated.status).toBe('ACTIVE');

      const found = service.accounts().find((a) => a.id === 'acc-002');
      expect(found?.status).toBe('ACTIVE');
    });

    it('should prevent closing an account with non-zero balance (BR-F05)', async () => {
      // acc-001 balance is 15420.50
      await expect(service.closeAccount('acc-001')).rejects.toThrow(
        /Derived balance must be strictly zero/i,
      );
    });

    it('should successfully close a zero-balance account and update status to CLOSED', async () => {
      const { apiClient } = await import('@ble-frontend/api-client');
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({});

      // acc-002 has 0.00 balance
      await service.closeAccount('acc-002');

      const found = service.accounts().find((a) => a.id === 'acc-002');
      expect(found?.status).toBe('CLOSED');
    });

    it('should record error signal when API call fails during lifecycle mutation', async () => {
      const { apiClient } = await import('@ble-frontend/api-client');
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Server error 500'));

      await expect(service.freezeAccount('acc-001', 'Reason test')).rejects.toThrow(
        'Server error 500',
      );
      expect(service.error()).toBe('Server error 500');
    });
  });
});
