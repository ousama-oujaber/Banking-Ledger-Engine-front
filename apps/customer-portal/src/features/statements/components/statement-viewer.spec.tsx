import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Currency, Money } from '@ble-frontend/domain-types';
import { StatementViewer } from './statement-viewer';
import { AccountStatement } from '../types';
import * as exportUtils from '../utils/statement-export';

describe('StatementViewer Component', () => {
  const mockStatement: AccountStatement = {
    id: 'stmt-001',
    accountId: 'acc-777',
    fromDate: '2026-09-01',
    toDate: '2026-09-23',
    currency: Currency.EUR,
    openingBalance: Money.from('1000.00', Currency.EUR),
    closingBalance: Money.from('1200.00', Currency.EUR),
    totalCredits: Money.from('300.00', Currency.EUR),
    totalDebits: Money.from('100.00', Currency.EUR),
    entryCount: 2,
    generatedAt: '2026-09-23T15:00:00Z',
    entries: [
      {
        entryId: 'e1',
        transactionId: 'tx-1',
        entryDate: '2026-09-05T10:00:00Z',
        valueDate: '2026-09-05T10:00:00Z',
        description: 'Salary payment',
        reference: 'REF-SALARY',
        debitAmount: Money.from('0.00', Currency.EUR),
        creditAmount: Money.from('300.00', Currency.EUR),
        runningBalance: Money.from('1300.00', Currency.EUR),
      },
      {
        entryId: 'e2',
        transactionId: 'tx-2',
        entryDate: '2026-09-10T12:00:00Z',
        valueDate: '2026-09-10T12:00:00Z',
        description: 'Store purchase',
        reference: 'REF-STORE',
        debitAmount: Money.from('100.00', Currency.EUR),
        creditAmount: Money.from('0.00', Currency.EUR),
        runningBalance: Money.from('1200.00', Currency.EUR),
      },
    ],
  };

  it('renders statement summary cards and table entries', () => {
    render(<StatementViewer statement={mockStatement} />);

    expect(screen.getByTestId('statement-viewer')).toBeInTheDocument();
    expect(screen.getByText(/Statement for Account acc-777/)).toBeInTheDocument();
    expect(screen.getByTestId('summary-opening-balance')).toHaveTextContent('€1,000.00');
    expect(screen.getByTestId('summary-closing-balance')).toHaveTextContent('€1,200.00');

    expect(screen.getByText('Salary payment')).toBeInTheDocument();
    expect(screen.getByText('Store purchase')).toBeInTheDocument();
  });

  it('toggles between Table view and JSON view', () => {
    render(<StatementViewer statement={mockStatement} />);

    expect(screen.getByTestId('statement-table')).toBeInTheDocument();
    expect(screen.queryByTestId('statement-json-preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-view-json'));

    expect(screen.queryByTestId('statement-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('statement-json-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-view-table'));
    expect(screen.getByTestId('statement-table')).toBeInTheDocument();
  });

  it('triggers CSV and JSON downloads when action buttons are clicked', () => {
    const csvSpy = vi.spyOn(exportUtils, 'downloadStatementCsv').mockImplementation(() => {});
    const jsonSpy = vi.spyOn(exportUtils, 'downloadStatementJson').mockImplementation(() => {});

    render(<StatementViewer statement={mockStatement} />);

    fireEvent.click(screen.getByTestId('download-csv-btn'));
    expect(csvSpy).toHaveBeenCalledWith(mockStatement);

    fireEvent.click(screen.getByTestId('download-json-btn'));
    expect(jsonSpy).toHaveBeenCalledWith(mockStatement);
  });

  it('renders empty message when no entries exist in statement', () => {
    const emptyStatement: AccountStatement = {
      ...mockStatement,
      entries: [],
    };

    render(<StatementViewer statement={emptyStatement} />);
    expect(screen.getByTestId('statement-no-entries')).toBeInTheDocument();
    expect(
      screen.getByText(/No transactions recorded for this statement period/),
    ).toBeInTheDocument();
  });
});
