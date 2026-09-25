import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as accountsHookModule from '../accounts/hooks/use-accounts';
import * as fxHookModule from './hooks/use-fx';
import { FxPage } from './fx-page';

describe('FxPage Component', () => {
  let queryClient: QueryClient;

  const mockAccounts = [
    {
      id: 'acc-eur',
      accountNumber: 'ACC-EUR',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      availableBalance: Money.from('2000.00', Currency.EUR),
      ledgerBalance: Money.from('2000.00', Currency.EUR),
      holdBalance: Money.from('0.00', Currency.EUR),
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'acc-usd',
      accountNumber: 'ACC-USD',
      ownerId: 'cust-1',
      currency: Currency.USD,
      status: 'ACTIVE',
      availableBalance: Money.from('1500.00', Currency.USD),
      ledgerBalance: Money.from('1500.00', Currency.USD),
      holdBalance: Money.from('0.00', Currency.USD),
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

    vi.spyOn(fxHookModule, 'useFxRates').mockReturnValue({
      data: [
        {
          id: 'eur-usd',
          sourceCurrency: Currency.EUR,
          targetCurrency: Currency.USD,
          rate: 1.085,
          timestamp: '2026-09-23T12:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);

    vi.spyOn(fxHookModule, 'useExecuteFxTransferMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);
  });

  it('renders FxPage with transfer form and live rates table', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FxPage />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('fx-page')).toBeInTheDocument();
    expect(screen.getByText('Foreign Exchange & Cross-Currency Transfers')).toBeInTheDocument();
    expect(screen.getByTestId('fx-transfer-form')).toBeInTheDocument();
    expect(screen.getByTestId('fx-rates-table')).toBeInTheDocument();
    expect(screen.getByText('EUR / USD')).toBeInTheDocument();
  });
});
