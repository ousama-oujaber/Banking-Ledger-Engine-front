import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency } from '@ble-frontend/domain-types';
import * as fxHookModule from '../hooks/use-fx';
import { FxRatesTable } from './fx-rates-table';
import type { FxRate } from '../types';

describe('FxRatesTable Component (FR-CUST-FX-01)', () => {
  const mockRates: FxRate[] = [
    {
      id: 'eur-usd',
      sourceCurrency: Currency.EUR,
      targetCurrency: Currency.USD,
      rate: 1.085,
      spread: 0.002,
      effectiveRate: 1.083,
    },
    {
      id: 'eur-gbp',
      sourceCurrency: Currency.EUR,
      targetCurrency: Currency.GBP,
      rate: 0.855,
      spread: 0.001,
      effectiveRate: 0.854,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(fxHookModule, 'useFxRates').mockReturnValue({
      data: mockRates,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);
  });

  it('renders loading state when isLoading is true', () => {
    vi.spyOn(fxHookModule, 'useFxRates').mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    render(<FxRatesTable />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading live exchange rates...');
  });

  it('renders error state when isError is true', () => {
    vi.spyOn(fxHookModule, 'useFxRates').mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Rate service offline'),
    } as any);

    render(<FxRatesTable />);
    expect(screen.getByRole('alert')).toHaveTextContent('Rate service offline');
  });

  it('renders rates table and calls onSelectPair when Convert is clicked', async () => {
    const user = userEvent.setup();
    const onSelectPair = vi.fn();

    render(<FxRatesTable onSelectPair={onSelectPair} />);

    expect(screen.getByTestId('fx-rates-table')).toBeInTheDocument();
    expect(screen.getByTestId('fx-rate-row-eur-usd')).toBeInTheDocument();
    expect(screen.getByTestId('fx-rate-val-eur-usd')).toHaveTextContent('1.0850');

    const convertBtn = screen.getByTestId('fx-select-pair-eur-usd');
    await user.click(convertBtn);

    expect(onSelectPair).toHaveBeenCalledWith('EUR', 'USD');
  });
});
