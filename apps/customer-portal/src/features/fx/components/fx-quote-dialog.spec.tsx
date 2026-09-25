import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as fxHookModule from '../hooks/use-fx';
import { FxQuoteDialog, calculateRemainingSeconds, formatCountdown } from './fx-quote-dialog';
import type { FxQuote } from '../types';

describe('FxQuoteDialog Component (FR-CUST-FX-01, FR-CUST-FX-02)', () => {
  const mockActiveQuote: FxQuote = {
    id: 'q-101',
    quoteReference: 'QR-101',
    sourceCurrency: Currency.EUR,
    targetCurrency: Currency.USD,
    sourceAmount: Money.from('500.00', Currency.EUR),
    targetAmount: Money.from('542.50', Currency.USD),
    exchangeRate: 1.085,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 60000).toISOString(), // 60s remaining
    createdAt: new Date().toISOString(),
  };

  let executeMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    executeMutateMock = vi.fn().mockResolvedValue({
      id: 'tx-fx-settled-1',
      type: 'FX_TRANSFER',
      state: 'COMMITTED',
    });

    vi.spyOn(fxHookModule, 'useExecuteFxTransferMutation').mockReturnValue({
      mutateAsync: executeMutateMock,
      isPending: false,
    } as any);
  });

  describe('Helper Functions', () => {
    it('formatCountdown formats seconds into MM:SS', () => {
      expect(formatCountdown(65)).toBe('01:05');
      expect(formatCountdown(5)).toBe('00:05');
      expect(formatCountdown(0)).toBe('00:00');
    });

    it('calculateRemainingSeconds handles null or past dates', () => {
      expect(calculateRemainingSeconds(undefined)).toBe(0);
      const past = new Date(Date.now() - 5000).toISOString();
      expect(calculateRemainingSeconds(past)).toBe(0);
    });
  });

  it('renders active quote conversion details and active countdown', () => {
    render(
      <FxQuoteDialog
        quote={mockActiveQuote}
        sourceAccountId="acc-eur-1"
        destinationAccountId="acc-usd-2"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fx-quote-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('fx-quote-source-amount')).toHaveTextContent('€500.00');
    expect(screen.getByTestId('fx-quote-rate')).toHaveTextContent('1 EUR = 1.0850 USD');
    expect(screen.getByTestId('fx-quote-target-amount')).toHaveTextContent('$542.50');
    expect(screen.getByTestId('fx-execute-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('fx-quote-expired-badge')).not.toBeInTheDocument();
  });

  it('disables execute button and shows EXPIRED badge when quote has expired', () => {
    const expiredQuote: FxQuote = {
      ...mockActiveQuote,
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    render(
      <FxQuoteDialog
        quote={expiredQuote}
        sourceAccountId="acc-eur-1"
        destinationAccountId="acc-usd-2"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fx-quote-expired-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('fx-execute-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('fx-refresh-quote-btn')).toBeInTheDocument();
  });

  it('executes FX transfer and renders dual-leg accounting confirmation', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <FxQuoteDialog
        quote={mockActiveQuote}
        sourceAccountId="acc-eur-1"
        destinationAccountId="acc-usd-2"
        isOpen={true}
        onClose={vi.fn()}
        onTransferSuccess={onSuccess}
      />,
    );

    const executeBtn = screen.getByTestId('fx-execute-btn');
    await user.click(executeBtn);

    expect(executeMutateMock).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Dual-leg confirmation should be shown
    expect(screen.getByTestId('fx-dual-leg-confirmation')).toBeInTheDocument();
    expect(screen.getByText('Leg 1: Source Debit')).toBeInTheDocument();
    expect(screen.getByText('Leg 2: Destination Credit')).toBeInTheDocument();
  });
});
