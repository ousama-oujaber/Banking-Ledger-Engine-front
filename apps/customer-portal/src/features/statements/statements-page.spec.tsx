import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as accountsHookModule from '../accounts/hooks/use-accounts';
import * as statementHookModule from './hooks/use-statement';
import { StatementsPage } from './statements-page';
import { AccountStatement } from './types';

describe('StatementsPage Component', () => {
  let queryClient: QueryClient;

  const mockAccounts = [
    {
      id: 'acc-1',
      accountNumber: 'ACC-001',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      availableBalance: Money.from('1000.00', Currency.EUR),
      ledgerBalance: Money.from('1000.00', Currency.EUR),
      holdBalance: Money.from('0.00', Currency.EUR),
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const mockStatement: AccountStatement = {
    id: 'stmt-1',
    accountId: 'acc-1',
    fromDate: '2026-09-01',
    toDate: '2026-09-20',
    currency: Currency.EUR,
    openingBalance: Money.from('500.00', Currency.EUR),
    closingBalance: Money.from('1000.00', Currency.EUR),
    totalCredits: Money.from('500.00', Currency.EUR),
    totalDebits: Money.from('0.00', Currency.EUR),
    entryCount: 0,
    generatedAt: '2026-09-20T10:00:00Z',
    entries: [],
  };

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

  it('renders StatementGeneratorForm initially and displays StatementViewer upon generation', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(mockStatement);
    vi.spyOn(statementHookModule, 'useGenerateStatementMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <StatementsPage />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('statements-page')).toBeInTheDocument();
    expect(screen.getByTestId('statement-generator-form')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('generate-statement-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('statement-viewer')).toBeInTheDocument();
    });

    expect(screen.getByTestId('generate-another-statement-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('generate-another-statement-btn'));
    expect(screen.getByTestId('statement-generator-form')).toBeInTheDocument();
  });
});
