import React, { useState } from 'react';
import { AccountStatement } from '../types';
import { downloadStatementCsv, downloadStatementJson } from '../utils/statement-export';

export interface StatementViewerProps {
  statement: AccountStatement;
  onClose?: () => void;
}

export const StatementViewer: React.FC<StatementViewerProps> = ({ statement, onClose }) => {
  const [viewFormat, setViewFormat] = useState<'TABLE' | 'JSON'>('TABLE');

  return (
    <div className="statement-viewer" data-testid="statement-viewer">
      <div className="statement-viewer__header">
        <div>
          <h3 className="statement-viewer__title">Statement for Account {statement.accountId}</h3>
          <p className="statement-viewer__period">
            Period: {statement.fromDate} &mdash; {statement.toDate}
          </p>
        </div>
        <div className="statement-viewer__actions">
          <div className="statement-viewer__format-toggle">
            <button
              type="button"
              className={`btn btn--sm ${viewFormat === 'TABLE' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewFormat('TABLE')}
              data-testid="toggle-view-table"
            >
              Table View
            </button>
            <button
              type="button"
              className={`btn btn--sm ${viewFormat === 'JSON' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewFormat('JSON')}
              data-testid="toggle-view-json"
            >
              JSON View
            </button>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => downloadStatementCsv(statement)}
            data-testid="download-csv-btn"
          >
            Download CSV
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => downloadStatementJson(statement)}
            data-testid="download-json-btn"
          >
            Download JSON
          </button>
          {onClose && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onClose}
              data-testid="close-statement-btn"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="statement-viewer__summary-cards" data-testid="statement-summary">
        <div className="summary-card">
          <span className="summary-card__label">Opening Balance</span>
          <span className="summary-card__value" data-testid="summary-opening-balance">
            {statement.openingBalance.format()}
          </span>
        </div>
        <div className="summary-card summary-card--credit">
          <span className="summary-card__label">Total Credits</span>
          <span className="summary-card__value" data-testid="summary-total-credits">
            +{statement.totalCredits.format()}
          </span>
        </div>
        <div className="summary-card summary-card--debit">
          <span className="summary-card__label">Total Debits</span>
          <span className="summary-card__value" data-testid="summary-total-debits">
            -{statement.totalDebits.format()}
          </span>
        </div>
        <div className="summary-card summary-card--closing">
          <span className="summary-card__label">Closing Balance</span>
          <span className="summary-card__value" data-testid="summary-closing-balance">
            {statement.closingBalance.format()}
          </span>
        </div>
      </div>

      {viewFormat === 'TABLE' ? (
        statement.entries.length === 0 ? (
          <div className="statement-viewer__empty" data-testid="statement-no-entries">
            <p>No transactions recorded for this statement period.</p>
          </div>
        ) : (
          <div className="statement-viewer__table-container">
            <table className="statement-table" data-testid="statement-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Debit</th>
                  <th scope="col">Credit</th>
                  <th scope="col">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.entries.map((entry) => (
                  <tr key={entry.entryId} data-testid={`statement-entry-${entry.entryId}`}>
                    <td className="statement-table__date">
                      {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="statement-table__ref">
                      <code>{entry.reference || '—'}</code>
                    </td>
                    <td className="statement-table__desc">{entry.description || '—'}</td>
                    <td className="statement-table__debit">
                      {entry.debitAmount.isZero() ? '—' : `-${entry.debitAmount.format()}`}
                    </td>
                    <td className="statement-table__credit">
                      {entry.creditAmount.isZero() ? '—' : `+${entry.creditAmount.format()}`}
                    </td>
                    <td className="statement-table__balance">
                      <strong>{entry.runningBalance.format()}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="statement-viewer__json-preview" data-testid="statement-json-preview">
          <pre>
            {JSON.stringify(
              {
                id: statement.id,
                accountId: statement.accountId,
                fromDate: statement.fromDate,
                toDate: statement.toDate,
                currency: statement.currency,
                openingBalance: statement.openingBalance.format(),
                closingBalance: statement.closingBalance.format(),
                totalCredits: statement.totalCredits.format(),
                totalDebits: statement.totalDebits.format(),
                entryCount: statement.entryCount,
                entries: statement.entries.map((e) => ({
                  ...e,
                  debitAmount: e.debitAmount.format(),
                  creditAmount: e.creditAmount.format(),
                  runningBalance: e.runningBalance.format(),
                })),
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
};
