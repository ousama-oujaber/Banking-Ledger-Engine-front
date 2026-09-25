import React, { useState } from 'react';
import { Account } from '../../accounts/types';
import { GenerateStatementParams } from '../types';

export interface StatementGeneratorFormProps {
  accounts: Account[];
  isLoading?: boolean;
  onGenerate: (params: GenerateStatementParams) => Promise<void> | void;
  serverError?: string | null;
}

export const StatementGeneratorForm: React.FC<StatementGeneratorFormProps> = ({
  accounts,
  isLoading = false,
  onGenerate,
  serverError = null,
}) => {
  const getDefaultDates = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return {
      to: today.toISOString().split('T')[0],
      from: thirtyDaysAgo.toISOString().split('T')[0],
    };
  };

  const initialDates = getDefaultDates();
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [fromDate, setFromDate] = useState(initialDates.from);
  const [toDate, setToDate] = useState(initialDates.to);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedAccountId.trim()) {
      newErrors.accountId = 'Please select or specify an account';
    }

    if (!fromDate) {
      newErrors.fromDate = 'From date is required';
    }

    if (!toDate) {
      newErrors.toDate = 'To date is required';
    }

    if (fromDate && toDate && fromDate > toDate) {
      newErrors.toDate = 'To date cannot be earlier than From date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onGenerate({
      accountId: selectedAccountId.trim(),
      fromDate,
      toDate,
    });
  };

  return (
    <div className="statement-generator-form" data-testid="statement-generator-form">
      <div className="statement-generator-form__header">
        <h2 className="statement-generator-form__title">Generate Account Statement</h2>
        <p className="statement-generator-form__subtitle">
          Export an official double-entry ledger statement for any periodic date range.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div
            className="form-alert form-alert--error"
            role="alert"
            data-testid="statement-server-error"
          >
            {serverError}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="statement-account-select" className="form-label">
            Account *
          </label>
          {accounts.length > 0 ? (
            <select
              id="statement-account-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={isLoading}
              className={`form-select ${errors.accountId ? 'form-select--error' : ''}`}
              data-testid="statement-account-select"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} ({acc.currency}) — Balance:{' '}
                  {(acc.availableBalance || acc.derivedBalance).format()}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="statement-account-select"
              type="text"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={isLoading}
              placeholder="Enter Account ID"
              className={`form-input ${errors.accountId ? 'form-input--error' : ''}`}
              data-testid="statement-account-input"
            />
          )}
          {errors.accountId && (
            <span className="form-error" data-testid="statement-account-error">
              {errors.accountId}
            </span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group form-col">
            <label htmlFor="statement-from-date" className="form-label">
              From Date *
            </label>
            <input
              id="statement-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={isLoading}
              className={`form-input ${errors.fromDate ? 'form-input--error' : ''}`}
              data-testid="statement-from-date-input"
            />
            {errors.fromDate && (
              <span className="form-error" data-testid="statement-from-date-error">
                {errors.fromDate}
              </span>
            )}
          </div>

          <div className="form-group form-col">
            <label htmlFor="statement-to-date" className="form-label">
              To Date *
            </label>
            <input
              id="statement-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={isLoading}
              className={`form-input ${errors.toDate ? 'form-input--error' : ''}`}
              data-testid="statement-to-date-input"
            />
            {errors.toDate && (
              <span className="form-error" data-testid="statement-to-date-error">
                {errors.toDate}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary"
          disabled={isLoading}
          data-testid="generate-statement-btn"
        >
          {isLoading ? 'Generating Statement...' : 'Generate Statement'}
        </button>
      </form>
    </div>
  );
};
