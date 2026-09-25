import React, { useState } from 'react';
import { Beneficiary } from '../types';

export interface BeneficiaryListProps {
  beneficiaries: Beneficiary[];
  isLoading?: boolean;
  error?: Error | null;
  onAddClick: () => void;
  onDeleteClick: (beneficiary: Beneficiary) => void;
  onSelectForTransfer?: (beneficiary: Beneficiary) => void;
}

export const BeneficiaryList: React.FC<BeneficiaryListProps> = ({
  beneficiaries,
  isLoading = false,
  error = null,
  onAddClick,
  onDeleteClick,
  onSelectForTransfer,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  if (isLoading) {
    return (
      <div
        className="beneficiaries-list beneficiaries-list--loading"
        data-testid="beneficiaries-loading"
      >
        <p>Loading beneficiaries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="beneficiaries-list beneficiaries-list--error"
        data-testid="beneficiaries-error"
      >
        <p role="alert">Failed to load beneficiaries: {error.message}</p>
      </div>
    );
  }

  const filtered = beneficiaries.filter(
    (b) =>
      b.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      b.destinationAccountId.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (b.iban && b.iban.toLowerCase().includes(filterQuery.toLowerCase())),
  );

  return (
    <div className="beneficiaries-list" data-testid="beneficiaries-list">
      <div className="beneficiaries-list__header">
        <div>
          <h2 className="beneficiaries-list__title">Beneficiaries</h2>
          <p className="beneficiaries-list__subtitle">
            Manage your saved payees for quick and safe transfers.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onAddClick}
          data-testid="add-beneficiary-btn"
        >
          + Add Beneficiary
        </button>
      </div>

      <div className="beneficiaries-list__toolbar">
        <input
          type="search"
          placeholder="Filter by name, account ID, or IBAN..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="beneficiaries-list__search-input"
          data-testid="beneficiary-search-input"
          aria-label="Filter beneficiaries"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="beneficiaries-list__empty" data-testid="beneficiaries-empty">
          <p>
            {beneficiaries.length === 0
              ? 'No beneficiaries found. Add a beneficiary to simplify future transfers.'
              : 'No beneficiaries matching your filter.'}
          </p>
        </div>
      ) : (
        <div className="beneficiaries-list__table-container">
          <table className="beneficiaries-table" data-testid="beneficiaries-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Account ID</th>
                <th scope="col">Currency</th>
                <th scope="col">IBAN</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((beneficiary) => (
                <tr key={beneficiary.id} data-testid={`beneficiary-row-${beneficiary.id}`}>
                  <td className="beneficiaries-table__name">{beneficiary.name}</td>
                  <td className="beneficiaries-table__account">
                    <code>{beneficiary.destinationAccountId}</code>
                  </td>
                  <td className="beneficiaries-table__currency">{beneficiary.currency}</td>
                  <td className="beneficiaries-table__iban">
                    {beneficiary.iban ? <code>{beneficiary.iban}</code> : '—'}
                  </td>
                  <td className="beneficiaries-table__status">
                    <span
                      className={`badge badge--status-${beneficiary.status.toLowerCase()}`}
                      data-testid={`badge-status-${beneficiary.id}`}
                    >
                      {beneficiary.status}
                    </span>
                  </td>
                  <td className="beneficiaries-table__actions">
                    {onSelectForTransfer && beneficiary.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => onSelectForTransfer(beneficiary)}
                        data-testid={`transfer-to-${beneficiary.id}`}
                      >
                        Send Money
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => onDeleteClick(beneficiary)}
                      data-testid={`delete-beneficiary-${beneficiary.id}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
