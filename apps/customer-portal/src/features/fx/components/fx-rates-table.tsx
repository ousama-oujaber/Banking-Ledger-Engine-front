import { useFxRates } from '../hooks/use-fx';
import { DomainErrorBanner } from '../../errors';

export interface FxRatesTableProps {
  sourceCurrency?: string;
  targetCurrency?: string;
  onSelectPair?: (source: string, target: string) => void;
}

/**
 * Table displaying real-time foreign exchange market rates (FR-CUST-FX-01).
 */
export function FxRatesTable({ sourceCurrency, targetCurrency, onSelectPair }: FxRatesTableProps) {
  const {
    data: rates = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useFxRates({
    sourceCurrency,
    targetCurrency,
  });

  if (isLoading) {
    return (
      <div className="fx-rates-table__state fx-rates-table__state--loading" role="status">
        Loading live exchange rates...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fx-rates-table__state fx-rates-table__state--error">
        <DomainErrorBanner error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div
        className="fx-rates-table__state fx-rates-table__state--empty"
        data-testid="fx-rates-empty"
      >
        No active currency pairs available at this time.
      </div>
    );
  }

  return (
    <div className="fx-rates-table-container" data-testid="fx-rates-table-container">
      <table className="fx-rates-table" data-testid="fx-rates-table">
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Rate</th>
            <th scope="col">Spread</th>
            <th scope="col">Effective Rate</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => {
            const pairLabel = `${rate.sourceCurrency} / ${rate.targetCurrency}`;
            return (
              <tr key={rate.id} data-testid={`fx-rate-row-${rate.id}`}>
                <td>
                  <strong>{pairLabel}</strong>
                </td>
                <td data-testid={`fx-rate-val-${rate.id}`}>{rate.rate.toFixed(4)}</td>
                <td>{rate.spread ? `${(rate.spread * 100).toFixed(2)}%` : '0.00%'}</td>
                <td>
                  <strong>{(rate.effectiveRate ?? rate.rate).toFixed(4)}</strong>
                </td>
                <td>
                  <button
                    type="button"
                    className="fx-rates-table__select-btn"
                    onClick={() =>
                      onSelectPair?.(rate.sourceCurrency.toString(), rate.targetCurrency.toString())
                    }
                    data-testid={`fx-select-pair-${rate.id}`}
                  >
                    Convert
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
