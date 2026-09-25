import React from 'react';
import { FxRatesTable } from './components/fx-rates-table';
import { FxTransferForm } from './components/fx-transfer-form';

export const FxPage: React.FC = () => {
  return (
    <div className="fx-page" data-testid="fx-page">
      <header className="fx-page__header">
        <h2 className="fx-page__title">Foreign Exchange & Cross-Currency Transfers</h2>
        <p className="fx-page__subtitle">
          Real-time rates with guaranteed quote lock countdowns and dual-leg settlement.
        </p>
      </header>

      <div className="fx-page__grid">
        <section className="fx-page__form-section">
          <FxTransferForm />
        </section>

        <section className="fx-page__rates-section">
          <FxRatesTable />
        </section>
      </div>
    </div>
  );
};
