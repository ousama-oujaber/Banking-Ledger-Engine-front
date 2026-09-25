import React, { useState } from 'react';
import { Currency } from '@ble-frontend/domain-types';
import { CreateBeneficiaryCommand } from '../types';

export interface BeneficiaryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (command: CreateBeneficiaryCommand) => Promise<void> | void;
  isSubmitting?: boolean;
  serverError?: string | null;
}

const SUPPORTED_CURRENCIES: Currency[] = [
  Currency.EUR,
  Currency.USD,
  Currency.GBP,
  Currency.JPY,
  Currency.KRW,
  Currency.BHD,
  Currency.KWD,
  Currency.MAD,
];

export const BeneficiaryFormModal: React.FC<BeneficiaryFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  serverError = null,
}) => {
  const [name, setName] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.EUR);
  const [iban, setIban] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Beneficiary name is required';
    }

    if (!destinationAccountId.trim()) {
      errors.destinationAccountId = 'Destination account ID is required';
    }

    if (iban.trim() && !/^[A-Z]{2}[0-9A-Z]{13,32}$/i.test(iban.trim().replace(/\s/g, ''))) {
      errors.iban = 'Invalid IBAN format';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        destinationAccountId: destinationAccountId.trim(),
        currency,
        iban: iban.trim() ? iban.trim().toUpperCase() : undefined,
      });
      // reset form
      setName('');
      setDestinationAccountId('');
      setCurrency(Currency.EUR);
      setIban('');
      setClientErrors({});
    } catch {
      // handled by parent or displayed via serverError prop
    }
  };

  return (
    <div className="modal-overlay" data-testid="beneficiary-form-modal-overlay" onClick={onClose}>
      <div
        className="modal modal--beneficiary-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="beneficiary-modal-title"
        data-testid="beneficiary-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="beneficiary-modal-title" className="modal__title">
            Add New Beneficiary
          </h2>
          <button
            type="button"
            className="modal__close-btn"
            onClick={onClose}
            aria-label="Close modal"
            data-testid="beneficiary-modal-close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body beneficiary-form" noValidate>
          {serverError && (
            <div
              className="form-alert form-alert--error"
              role="alert"
              data-testid="beneficiary-server-error"
            >
              {serverError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="beneficiary-name" className="form-label">
              Beneficiary Name *
            </label>
            <input
              id="beneficiary-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className={`form-input ${clientErrors.name ? 'form-input--error' : ''}`}
              placeholder="e.g. John Doe / ACME Corp"
              data-testid="beneficiary-name-input"
              aria-invalid={Boolean(clientErrors.name)}
              aria-describedby={clientErrors.name ? 'beneficiary-name-error' : undefined}
            />
            {clientErrors.name && (
              <span
                id="beneficiary-name-error"
                className="form-error"
                data-testid="beneficiary-name-error"
              >
                {clientErrors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="beneficiary-account-id" className="form-label">
              Destination Account ID *
            </label>
            <input
              id="beneficiary-account-id"
              type="text"
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              disabled={isSubmitting}
              className={`form-input ${clientErrors.destinationAccountId ? 'form-input--error' : ''}`}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              data-testid="beneficiary-account-id-input"
              aria-invalid={Boolean(clientErrors.destinationAccountId)}
              aria-describedby={
                clientErrors.destinationAccountId ? 'beneficiary-account-id-error' : undefined
              }
            />
            {clientErrors.destinationAccountId && (
              <span
                id="beneficiary-account-id-error"
                className="form-error"
                data-testid="beneficiary-account-id-error"
              >
                {clientErrors.destinationAccountId}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="beneficiary-currency" className="form-label">
              Account Currency *
            </label>
            <select
              id="beneficiary-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              disabled={isSubmitting}
              className="form-select"
              data-testid="beneficiary-currency-select"
            >
              {SUPPORTED_CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="beneficiary-iban" className="form-label">
              IBAN (Optional)
            </label>
            <input
              id="beneficiary-iban"
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              disabled={isSubmitting}
              className={`form-input ${clientErrors.iban ? 'form-input--error' : ''}`}
              placeholder="e.g. GB29NWBK60161331926819"
              data-testid="beneficiary-iban-input"
              aria-invalid={Boolean(clientErrors.iban)}
              aria-describedby={clientErrors.iban ? 'beneficiary-iban-error' : undefined}
            />
            {clientErrors.iban && (
              <span
                id="beneficiary-iban-error"
                className="form-error"
                data-testid="beneficiary-iban-error"
              >
                {clientErrors.iban}
              </span>
            )}
          </div>

          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="beneficiary-form-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
              data-testid="beneficiary-form-submit"
            >
              {isSubmitting ? 'Saving...' : 'Save Beneficiary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
