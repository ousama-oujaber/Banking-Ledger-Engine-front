import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import { AccountList, computeCurrencyTotals } from './account-list';
import * as useAccountsModule from '../hooks/use-accounts';
import type { Account } from '../types';

describe('AccountList Component & computeCurrencyTotals', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-eur-1',
      ownerId: 'cust-1',
      label: 'Main EUR Account',
      currency: Currency.EUR,
      type: AccountType.CLASSIC,
      status: AccountStatus.ACTIVE,
      derivedBalance: Money.from('1000.50', Currency.EUR),
      allowOverdraft: false,
      version: 1,
    },
    {
      id: 'acc-eur-2',
      ownerId: 'cust-1',
      label: 'EUR Savings',
      currency: Currency.EUR,
      type: AccountType.SAVINGS,
      status: AccountStatus.ACTIVE,
      derivedBalance: Money.from('2500.25', Currency.EUR),
      allowOverdraft: false,
      version: 1,
    },
    {
      id: 'acc-usd-1',
      ownerId: 'cust-1',
      label: 'USD Trading',
      currency: Currency.USD,
      type: AccountType.CLASSIC,
      status: AccountStatus.ACTIVE,
      derivedBalance: Money.from('500.00', Currency.USD),
      allowOverdraft: false,
      version: 1,
    },
  ];

  describe('computeCurrencyTotals', () => {
    it('aggregates balances grouped by currency without cross-currency mixing', () => {
      const totals = computeCurrencyTotals(mockAccounts);

      expect(totals).toHaveLength(2);

      const eurTotal = totals.find((t) => t.currency === Currency.EUR);
      const usdTotal = totals.find((t) => t.currency === Currency.USD);

      expect(eurTotal).toBeDefined();
      expect(eurTotal?.amount.toFixed()).toBe('3500.75');

      expect(usdTotal).toBeDefined();
      expect(usdTotal?.amount.toFixed()).toBe('500');
    });

    it('returns empty array when no accounts are provided', () => {
      expect(computeCurrencyTotals([])).toEqual([]);
    });
  });

  describe('AccountList UI States', () => {
    it('renders loading state when isLoading is true', () => {
      vi.spyOn(useAccountsModule, 'useAccounts').mockReturnValue({
        accounts: [],
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      });

      render(<AccountList />);
      expect(screen.getByRole('status')).toHaveTextContent('Loading your accounts and balances...');
    });

    it('renders error state and triggers retry when refetch button is clicked', async () => {
      const user = userEvent.setup();
      const refetchMock = vi.fn();

      vi.spyOn(useAccountsModule, 'useAccounts').mockReturnValue({
        accounts: [],
        isLoading: false,
        isError: true,
        error: new Error('Network timeout'),
        refetch: refetchMock,
        isFetching: false,
      });

      render(<AccountList />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Network timeout')).toBeInTheDocument();

      const retryBtn = screen.getByTestId('accounts-retry-btn');
      await user.click(retryBtn);

      expect(refetchMock).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when accounts list is empty', () => {
      vi.spyOn(useAccountsModule, 'useAccounts').mockReturnValue({
        accounts: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      });

      render(<AccountList />);

      expect(screen.getByTestId('accounts-empty')).toBeInTheDocument();
      expect(screen.getByText('No Accounts Found')).toBeInTheDocument();
    });

    it('renders account grid and currency portfolio summary when accounts are present', () => {
      vi.spyOn(useAccountsModule, 'useAccounts').mockReturnValue({
        accounts: mockAccounts,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      });

      render(<AccountList />);

      expect(screen.getByTestId('portfolio-summary')).toBeInTheDocument();
      expect(screen.getByTestId('portfolio-total-EUR')).toHaveTextContent('€3,500.75');
      expect(screen.getByTestId('portfolio-total-USD')).toHaveTextContent('$500.00');

      expect(screen.getByTestId('account-grid')).toBeInTheDocument();
      expect(screen.getByTestId('account-card-acc-eur-1')).toBeInTheDocument();
      expect(screen.getByTestId('account-card-acc-eur-2')).toBeInTheDocument();
      expect(screen.getByTestId('account-card-acc-usd-1')).toBeInTheDocument();
    });
  });
});
