import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionState } from '@ble-frontend/domain-types';
import { TransactionStatusBadge } from './transaction-status-badge';

describe('TransactionStatusBadge Component', () => {
  it('renders settled badge for SETTLED or COMMITTED status', () => {
    render(<TransactionStatusBadge state={TransactionState.SETTLED} />);
    const badge = screen.getByTestId('tx-status-badge');

    expect(badge).toHaveTextContent('Settled');
    expect(badge).toHaveClass('tx-status-badge--settled');
    expect(badge).toHaveAttribute('data-state', 'SETTLED');
  });

  it('renders posted badge for POSTED status', () => {
    render(<TransactionStatusBadge state={TransactionState.POSTED} />);
    const badge = screen.getByTestId('tx-status-badge');

    expect(badge).toHaveTextContent('Posted');
    expect(badge).toHaveClass('tx-status-badge--posted');
  });

  it('renders failed badge for FAILED status', () => {
    render(<TransactionStatusBadge state={TransactionState.FAILED} />);
    const badge = screen.getByTestId('tx-status-badge');

    expect(badge).toHaveTextContent('Failed');
    expect(badge).toHaveClass('tx-status-badge--failed');
  });

  it('renders reversed badge for REVERSED status', () => {
    render(<TransactionStatusBadge state={TransactionState.REVERSED} />);
    const badge = screen.getByTestId('tx-status-badge');

    expect(badge).toHaveTextContent('Reversed');
    expect(badge).toHaveClass('tx-status-badge--reversed');
  });
});
