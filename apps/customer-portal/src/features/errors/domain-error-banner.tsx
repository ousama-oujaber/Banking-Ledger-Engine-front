import React, { useState, useEffect } from 'react';
import { AppError, parseBackendError } from './types';

export interface DomainErrorBannerProps {
  error: AppError | Error | unknown | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const DomainErrorBanner: React.FC<DomainErrorBannerProps> = ({
  error,
  onDismiss,
  onRetry,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const appError: AppError | null = error
    ? typeof error === 'object' && error !== null && 'code' in error && 'traceId' in error
      ? (error as AppError)
      : parseBackendError(error)
    : null;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(appError?.retryAfter ?? null);

  useEffect(() => {
    setSecondsLeft(appError?.retryAfter ?? null);
  }, [appError?.retryAfter]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  if (!appError) return null;

  const handleCopyTraceId = async () => {
    if (appError.traceId && appError.traceId !== 'N/A' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(appError.traceId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard access denied
      }
    }
  };

  const getAdvice = (status: number) => {
    switch (status) {
      case 409:
        return 'Account state was modified concurrently. Please refresh your accounts and retry.';
      case 422:
        return 'Please ensure that transfer amounts and account statuses comply with banking rules.';
      case 429:
        return 'Rate limit exceeded. Please wait a few moments before trying again.';
      default:
        return null;
    }
  };

  const advice = getAdvice(appError.status);

  return (
    <div
      className={`domain-error-banner domain-error-banner--status-${appError.status} ${className}`}
      role="alert"
      aria-live="assertive"
      data-testid="domain-error-banner"
    >
      <div className="domain-error-banner__content">
        <div className="domain-error-banner__header">
          <span className="domain-error-banner__code" data-testid="error-banner-code">
            Error {appError.code}
          </span>
          <span className="domain-error-banner__status" data-testid="error-banner-status">
            HTTP {appError.status}
          </span>
          {onDismiss && (
            <button
              type="button"
              className="domain-error-banner__dismiss-btn"
              onClick={onDismiss}
              aria-label="Dismiss error"
              data-testid="error-banner-dismiss"
            >
              &times;
            </button>
          )}
        </div>

        <p className="domain-error-banner__message" data-testid="error-banner-message">
          {appError.message}
        </p>

        {appError.fieldErrors && Object.keys(appError.fieldErrors).length > 0 && (
          <ul className="domain-error-banner__field-errors" data-testid="error-banner-field-errors">
            {Object.entries(appError.fieldErrors).map(([field, err]) => (
              <li key={field} data-testid={`field-error-${field}`}>
                <strong>{field}:</strong> {err}
              </li>
            ))}
          </ul>
        )}

        {advice && (
          <p className="domain-error-banner__advice" data-testid="error-banner-advice">
            {advice}
          </p>
        )}

        {secondsLeft !== null && secondsLeft > 0 && (
          <div className="domain-error-banner__countdown" data-testid="error-banner-countdown">
            ⏱️ Rate limit active: Retry available in {secondsLeft}s
          </div>
        )}

        <div className="domain-error-banner__footer">
          {appError.traceId && appError.traceId !== 'N/A' && (
            <div className="domain-error-banner__trace" data-testid="error-banner-trace">
              <span className="domain-error-banner__trace-label">Trace ID:</span>
              <code className="domain-error-banner__trace-id">{appError.traceId}</code>
              <button
                type="button"
                className="domain-error-banner__copy-btn"
                onClick={handleCopyTraceId}
                data-testid="error-banner-copy-trace"
                title="Click to copy Trace ID for support investigation"
              >
                {copied ? 'Copied!' : 'Copy Trace ID'}
              </button>
            </div>
          )}

          {appError.status === 409 && onRetry && (
            <button
              type="button"
              className="btn btn--secondary domain-error-banner__retry-btn"
              onClick={onRetry}
              data-testid="error-banner-retry-btn"
            >
              Refresh & Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
