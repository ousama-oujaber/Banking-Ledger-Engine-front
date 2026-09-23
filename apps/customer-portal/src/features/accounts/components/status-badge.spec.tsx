import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountStatus } from '@ble-frontend/domain-types';
import { StatusBadge } from './status-badge';

describe('StatusBadge Component', () => {
  it('should render active status with proper semantic class and label', () => {
    render(<StatusBadge status={AccountStatus.ACTIVE} />);
    const badge = screen.getByTestId('status-badge');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveClass('status-badge--active');
    expect(badge).toHaveAttribute('data-status', 'ACTIVE');
    expect(badge).toHaveAttribute('aria-label', 'Account status: Active');
  });

  it('should render frozen status with restricted warning label', () => {
    render(<StatusBadge status={AccountStatus.FROZEN} />);
    const badge = screen.getByTestId('status-badge');

    expect(badge).toHaveTextContent('Frozen (Restricted)');
    expect(badge).toHaveClass('status-badge--frozen');
    expect(badge).toHaveAttribute('data-status', 'FROZEN');
    expect(badge).toHaveAttribute('aria-label', 'Account status: Frozen (Restricted)');
  });

  it('should render closed status with terminal indicator', () => {
    render(<StatusBadge status={AccountStatus.CLOSED} />);
    const badge = screen.getByTestId('status-badge');

    expect(badge).toHaveTextContent('Closed');
    expect(badge).toHaveClass('status-badge--closed');
    expect(badge).toHaveAttribute('data-status', 'CLOSED');
    expect(badge).toHaveAttribute('aria-label', 'Account status: Closed');
  });
});
