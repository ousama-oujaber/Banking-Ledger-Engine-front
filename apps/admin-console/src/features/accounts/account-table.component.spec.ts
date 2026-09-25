import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountTableComponent } from './account-table.component';
import { AccountAdminService } from './services/account-admin.service';
import type { AccountResponse } from '@ble-frontend/api-client';

const mockTestAccounts: AccountResponse[] = [
  {
    id: 'acc-101',
    ownerId: 'cust-01',
    label: 'Corporate Checking',
    type: 'CLASSIC',
    currency: 'EUR',
    status: 'ACTIVE',
    derivedBalance: { amount: 5000.0, currency: 'EUR' },
  },
  {
    id: 'acc-102',
    ownerId: 'cust-02',
    label: 'Yield Savings',
    type: 'SAVINGS',
    currency: 'USD',
    status: 'FROZEN',
    derivedBalance: { amount: 0.0, currency: 'USD' },
  },
  {
    id: 'acc-103',
    ownerId: 'cust-01',
    label: 'Escrow Holdings',
    type: 'ESCROW',
    currency: 'GBP',
    status: 'CLOSED',
    derivedBalance: { amount: 0.0, currency: 'GBP' },
  },
];

describe('AccountTableComponent (S4-T2 High-Density Table)', () => {
  let component: AccountTableComponent;
  let service: AccountAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AccountAdminService();
    // Prevent auto-fetch inside constructor during unit test
    vi.spyOn(service, 'loadAccounts').mockResolvedValue();
    service.setAccounts(mockTestAccounts);

    component = new AccountTableComponent(service);
  });

  it('should initialize with loaded accounts and default controls', () => {
    expect(component.accounts().length).toBe(3);
    expect(component.totalCount()).toBe(3);
    expect(component.searchQuery()).toBe('');
    expect(component.statusFilter()).toBe('ALL');
    expect(component.typeFilter()).toBe('ALL');
    expect(component.currencyFilter()).toBe('ALL');
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should filter accounts when search query changes', () => {
    component.onSearchChange('acc-102');
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].id).toBe('acc-102');
    expect(component.hasActiveFilters()).toBe(true);
  });

  it('should filter accounts by status dropdown', () => {
    component.onStatusChange('FROZEN');
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].id).toBe('acc-102');

    component.onStatusChange('ACTIVE');
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].id).toBe('acc-101');
  });

  it('should filter accounts by type dropdown', () => {
    component.onTypeChange('SAVINGS');
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].type).toBe('SAVINGS');
  });

  it('should filter accounts by currency dropdown', () => {
    component.onCurrencyChange('GBP');
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].currency).toBe('GBP');
  });

  it('should reset all filters when reset button clicked', () => {
    component.onSearchChange('escrow');
    component.onStatusChange('CLOSED');
    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.statusFilter()).toBe('ALL');
    expect(component.hasActiveFilters()).toBe(false);
    expect(component.paginatedAccounts().length).toBe(3);
  });

  it('should toggle sort column and direction', () => {
    component.toggleSort('balance');
    expect(component.sortBy()).toBe('balance');
    expect(component.sortDirection()).toBe('asc');
    expect(component.paginatedAccounts()[0].id).toBe('acc-102'); // 0.00

    component.toggleSort('balance');
    expect(component.sortDirection()).toBe('desc');
    expect(component.paginatedAccounts()[0].id).toBe('acc-101'); // 5000.00
  });

  it('should handle pagination next, previous, and size changes', () => {
    component.onPageSizeChange(1);
    expect(component.totalPages()).toBe(3);
    expect(component.paginatedAccounts().length).toBe(1);
    expect(component.paginatedAccounts()[0].id).toBe('acc-101');

    component.nextPage();
    expect(component.currentPage()).toBe(2);
    expect(component.paginatedAccounts()[0].id).toBe('acc-102');

    component.nextPage();
    expect(component.currentPage()).toBe(3);
    expect(component.paginatedAccounts()[0].id).toBe('acc-103');

    // boundary check
    component.nextPage();
    expect(component.currentPage()).toBe(3);

    component.prevPage();
    expect(component.currentPage()).toBe(2);
  });

  it('should enforce zero balance rule for account close action (BR-F05)', () => {
    const activeNonZero = mockTestAccounts[0]; // balance 5000.00
    const frozenZero = mockTestAccounts[1]; // balance 0.00

    expect(component.canClose(activeNonZero)).toBe(false);
    expect(component.canClose(frozenZero)).toBe(true);
  });

  it('should copy account ID to clipboard and show feedback', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    await component.copyAccountId('acc-101');
    expect(writeTextSpy).toHaveBeenCalledWith('acc-101');
    expect(component.copiedAccountId()).toBe('acc-101');
  });
});
