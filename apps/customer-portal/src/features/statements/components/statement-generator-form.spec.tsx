import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Currency, Money } from '@ble-frontend/domain-types';
import { StatementGeneratorForm } from './statement-generator-form';
import { Account } from '../../accounts/types';

describe('StatementGeneratorForm Component', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      label: 'Main Checking',
      ownerId: 'cust-1',
      currency: Currency.EUR,
      status: 'ACTIVE',
      type: 'CHECKING',
      allowOverdraft: false,
      availableBalance: Money.from('1500.00', Currency.EUR),
      derivedBalance: Money.from('1500.00', Currency.EUR),
      ledgerBalance: Money.from('1500.00', Currency.EUR),
      heldAmount: Money.from('0.00', Currency.EUR),
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('renders form with account select and date inputs', () => {
    render(<StatementGeneratorForm accounts={mockAccounts} onGenerate={vi.fn()} />);

    expect(screen.getByTestId('statement-generator-form')).toBeInTheDocument();
    expect(screen.getByTestId('statement-account-select')).toBeInTheDocument();
    expect(screen.getByTestId('statement-from-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('statement-to-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-statement-btn')).toBeInTheDocument();
  });

  it('validates date range when fromDate is after toDate', async () => {
    const onGenerate = vi.fn();
    render(<StatementGeneratorForm accounts={mockAccounts} onGenerate={onGenerate} />);

    fireEvent.change(screen.getByTestId('statement-from-date-input'), {
      target: { value: '2026-09-25' },
    });
    fireEvent.change(screen.getByTestId('statement-to-date-input'), {
      target: { value: '2026-09-10' },
    });

    fireEvent.click(screen.getByTestId('generate-statement-btn'));

    expect(await screen.findByText('To date cannot be earlier than From date')).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('submits valid parameters successfully', async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(<StatementGeneratorForm accounts={mockAccounts} onGenerate={onGenerate} />);

    fireEvent.change(screen.getByTestId('statement-from-date-input'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByTestId('statement-to-date-input'), {
      target: { value: '2026-09-20' },
    });

    fireEvent.click(screen.getByTestId('generate-statement-btn'));

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledWith({
        accountId: 'acc-1',
        fromDate: '2026-09-01',
        toDate: '2026-09-20',
      });
    });
  });

  it('displays server error if passed', () => {
    render(
      <StatementGeneratorForm
        accounts={mockAccounts}
        onGenerate={vi.fn()}
        serverError="Account statement generation failed on backend"
      />,
    );

    expect(screen.getByTestId('statement-server-error')).toHaveTextContent(
      'Account statement generation failed on backend',
    );
  });
});
