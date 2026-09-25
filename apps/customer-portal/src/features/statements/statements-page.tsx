import React, { useState } from 'react';
import { useAccounts } from '../accounts';
import { useGenerateStatementMutation } from './hooks/use-statement';
import { StatementGeneratorForm } from './components/statement-generator-form';
import { StatementViewer } from './components/statement-viewer';
import { AccountStatement, GenerateStatementParams } from './types';
import { DomainErrorBanner } from '../errors';

export const StatementsPage: React.FC = () => {
  const { accounts, isLoading: isAccountsLoading } = useAccounts();
  const generateMutation = useGenerateStatementMutation();
  const [statement, setStatement] = useState<AccountStatement | null>(null);

  const handleGenerate = async (params: GenerateStatementParams) => {
    const res = await generateMutation.mutateAsync(params);
    setStatement(res);
  };

  return (
    <div className="statements-page" data-testid="statements-page">
      {generateMutation.error && (
        <DomainErrorBanner
          error={generateMutation.error}
          onDismiss={() => generateMutation.reset()}
        />
      )}

      <main className="statements-page__content">
        {!statement ? (
          <StatementGeneratorForm
            accounts={accounts}
            isLoading={isAccountsLoading || generateMutation.isPending}
            onGenerate={handleGenerate}
            serverError={
              generateMutation.error
                ? (generateMutation.error as any).message || 'Failed to generate statement'
                : null
            }
          />
        ) : (
          <div>
            <div className="statements-page__toolbar">
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setStatement(null)}
                data-testid="generate-another-statement-btn"
              >
                &larr; Generate Another Statement
              </button>
            </div>
            <StatementViewer statement={statement} onClose={() => setStatement(null)} />
          </div>
        )}
      </main>
    </div>
  );
};
