import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as accountsHookModule from '../../accounts/hooks/use-accounts';
import * as fxHookModule from '../hooks/use-fx';
import { FxTransferForm } from './fx-transfer-form';
import { FxQuote } from '../types';

describe('FxTransferForm Component', () => {
  let queryClient: QueryClient;

  const mockAccounts = [
    {
      id: 'acc-source-eur',
      accountNumber: 'ACC-EUR',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      label: 'EUR Checking',
      availableBalance: Money.from('2000.00', Currency.EUR),
      ledgerBalance: Money.from('2000.00', Currency.EUR),
      derivedBalance: Money.from('2000.00', Currency.EUR),
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
      label: 'USD Savings',
      availableBalance: Money.from('1500.00', Currency.USD),
      ledgerBalance: Money.from('1500.00', Currency.USD),
      derivedBalance: Money.from('1500.00', Currency.USD),
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
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FxTransferForm />
      </QueryClientProvider>,
    );
  };

  it('renders form inputs and options', () => {
    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByTestId('fx-transfer-form')).toBeInTheDocument();
    expect(screen.getByTestId('fx-source-acc-select')).toBeInTheDocument();
    expect(screen.getByTestId('fx-dest-acc-input')).toBeInTheDocument();
    expect(screen.getByTestId('fx-amount-input')).toBeInTheDocument();
    expect(screen.getByTestId('fx-target-currency-select')).toBeInTheDocument();
    expect(screen.getByTestId('fx-request-quote-btn')).toBeInTheDocument();
  });

  it('validates amount must be positive and non-empty', () => {
    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);

    renderComponent();

    fireEvent.change(screen.getByTestId('fx-dest-acc-input'), {
      target: { value: 'acc-dest-foreign' },
    });
    fireEvent.change(screen.getByTestId('fx-amount-input'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByTestId('fx-request-quote-btn'));

    expect(screen.getByTestId('fx-form-error')).toHaveTextContent(
      'Amount must be strictly positive',
    );
  });

  it('validates destination account cannot be identical to source account', () => {
    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);

    renderComponent();

    fireEvent.change(screen.getByTestId('fx-dest-acc-input'), {
      target: { value: 'acc-source-eur' },
    });
    fireEvent.change(screen.getByTestId('fx-amount-input'), {
      target: { value: '100' },
    });

    fireEvent.click(screen.getByTestId('fx-request-quote-btn'));

    expect(screen.getByTestId('fx-form-error')).toHaveTextContent(
      'Cannot transfer between identical accounts',
    );
  });

  it('requests quote and opens FxQuoteDialog upon success', async () => {
    const mockQuote: FxQuote = {
      id: 'quote-abc-123',
      quoteReference: 'QR-123',
      sourceCurrency: Currency.EUR,
      targetCurrency: Currency.USD,
      sourceAmount: Money.from('100.00', Currency.EUR),
      targetAmount: Money.from('108.50', Currency.USD),
      exchangeRate: 1.085,
      spread: 0.002,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const mutateAsync = vi.fn().mockResolvedValue(mockQuote);
    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as any);

    renderComponent();

    fireEvent.change(screen.getByTestId('fx-dest-acc-input'), {
      target: { value: 'acc-dest-foreign' },
    });
    fireEvent.change(screen.getByTestId('fx-amount-input'), {
      target: { value: '100' },
    });

    fireEvent.click(screen.getByTestId('fx-request-quote-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        sourceCurrency: Currency.EUR,
        targetCurrency: Currency.USD,
        sourceAmount: 100,
      });
    });

    expect(await screen.findByTestId('fx-quote-dialog')).toBeInTheDocument();
  });

  it('displays error when quote request mutation throws', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Rate provider timeout'));
    vi.spyOn(fxHookModule, 'useRequestQuoteMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as any);

    renderComponent();

    fireEvent.change(screen.getByTestId('fx-dest-acc-input'), {
      target: { value: 'acc-dest-foreign' },
    });
    fireEvent.change(screen.getByTestId('fx-amount-input'), {
      target: { value: '100' },
    });

    fireEvent.click(screen.getByTestId('fx-request-quote-btn'));

    expect(await screen.findByTestId('fx-form-error')).toHaveTextContent('Rate provider timeout');
  });
});
