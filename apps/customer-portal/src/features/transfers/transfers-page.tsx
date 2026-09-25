import React, { useState } from 'react';
import { useAccounts } from '../accounts';
import { TransferForm } from './components/transfer-form';
import { DepositWithdrawModal } from './components/deposit-withdraw-modal';

export const TransfersPage: React.FC = () => {
  const { accounts } = useAccounts();
  const [depositWithdrawType, setDepositWithdrawType] = useState<'DEPOSIT' | 'WITHDRAW' | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div className="transfers-page" data-testid="transfers-page">
      <header className="transfers-page__header">
        <div>
          <h2 className="transfers-page__title">Transfers & Cash Operations</h2>
          <p className="transfers-page__subtitle">
            Transfer funds securely across accounts or perform direct deposits & withdrawals.
          </p>
        </div>
        <div className="transfers-page__quick-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setSuccessMessage(null);
              setDepositWithdrawType('DEPOSIT');
            }}
            data-testid="open-deposit-btn"
          >
            + Deposit
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setSuccessMessage(null);
              setDepositWithdrawType('WITHDRAW');
            }}
            data-testid="open-withdraw-btn"
          >
            - Withdraw
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="alert alert--success" role="status" data-testid="transfers-success-message">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert__close-btn"
            onClick={() => setSuccessMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      <main className="transfers-page__content">
        <TransferForm
          onSuccess={(tx) => {
            setSuccessMessage(
              `Transfer reference ${tx.reference || tx.id} completed successfully.`,
            );
          }}
        />
      </main>

      <DepositWithdrawModal
        isOpen={depositWithdrawType !== null}
        mode={depositWithdrawType || 'DEPOSIT'}
        account={accounts[0] || null}
        onClose={() => setDepositWithdrawType(null)}
        onSuccess={() => {
          setSuccessMessage(
            `${depositWithdrawType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} completed successfully.`,
          );
          setDepositWithdrawType(null);
        }}
      />
    </div>
  );
};
