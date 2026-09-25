import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as accountsHookModule from '../accounts/hooks/use-accounts';
import * as transfersHookModule from './hooks/use-transfers';
import { TransfersPage } from './transfers-page';

describe('TransfersPage Component', () => {
  let queryClient: QueryClient;

  const mockAccounts = [
    {
      id: 'acc-1',
      accountNumber: 'ACC-001',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      label: 'Main Checking',
      availableBalance: Money.from('1000.00', Currency.EUR),
      ledgerBalance: Money.from('1000.00', Currency.EUR),
      derivedBalance: Money.from('1000.00', Currency.EUR),
      holdBalance: Money.from('0.00', Currency.EUR),
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'acc-2',
      accountNumber: 'ACC-002',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      label: 'Savings',
      availableBalance: Money.from('500.00', Currency.EUR),
      ledgerBalance: Money.from('500.00', Currency.EUR),
      derivedBalance: Money.from('500.00', Currency.EUR),
      holdBalance: Money.from('0.00', Currency.EUR),
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.restoreAllMocks();

    vi.spyOn(accountsHookModule, 'useAccounts').mockReturnValue({
      accounts: mockAccounts,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  const renderWithClient = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TransfersPage />
      </QueryClientProvider>,
    );
  };

  it('renders page header and transfer form', () => {
    renderWithClient();
    expect(screen.getByTestId('transfers-page')).toBeInTheDocument();
    expect(screen.getByText('Transfers & Cash Operations')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-form')).toBeInTheDocument();
  });

  it('opens and closes deposit modal', () => {
    renderWithClient();

    expect(screen.queryByTestId('deposit-withdraw-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-deposit-btn'));
    expect(screen.getByTestId('deposit-withdraw-modal')).toBeInTheDocument();
    expect(screen.getByText('Deposit Funds')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dw-cancel-btn'));
    expect(screen.queryByTestId('deposit-withdraw-modal')).not.toBeInTheDocument();
  });

  it('opens and closes withdraw modal', () => {
    renderWithClient();

    fireEvent.click(screen.getByTestId('open-withdraw-btn'));
    expect(screen.getByTestId('deposit-withdraw-modal')).toBeInTheDocument();
    expect(screen.getByText('Withdraw Funds')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dw-cancel-btn'));
    expect(screen.queryByTestId('deposit-withdraw-modal')).not.toBeInTheDocument();
  });
});
