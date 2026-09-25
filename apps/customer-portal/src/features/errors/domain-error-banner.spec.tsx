import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DomainErrorBanner } from './domain-error-banner';
import { AppError } from './types';

describe('DomainErrorBanner Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when error is null', () => {
    const { container } = render(<DomainErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders AppError with code, message, and traceId copy trigger', async () => {
    const appError: AppError = {
      status: 422,
      code: 'INSUFFICIENT_FUNDS',
      message: 'Available balance is lower than transfer amount',
      traceId: 'trace-422-sample-uuid',
      timestamp: '2026-09-23T15:00:00Z',
    };

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<DomainErrorBanner error={appError} />);

    expect(screen.getByTestId('domain-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('error-banner-code')).toHaveTextContent('Error INSUFFICIENT_FUNDS');
    expect(screen.getByTestId('error-banner-status')).toHaveTextContent('HTTP 422');
    expect(screen.getByTestId('error-banner-message')).toHaveTextContent(
      'Available balance is lower than transfer amount',
    );
    expect(screen.getByTestId('error-banner-advice')).toBeInTheDocument();
    expect(screen.getByTestId('error-banner-trace')).toBeInTheDocument();

    const copyBtn = screen.getByTestId('error-banner-copy-trace');
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('trace-422-sample-uuid');
    await waitFor(() => {
      expect(copyBtn).toHaveTextContent('Copied!');
    });
  });

  it('renders advice for HTTP 409 Conflict', () => {
    const appError: AppError = {
      status: 409,
      code: 'CONCURRENT_MODIFICATION',
      message: 'Version collision',
      traceId: 'trace-409',
      timestamp: '2026-09-23T15:00:00Z',
    };

    render(<DomainErrorBanner error={appError} />);
    expect(screen.getByTestId('error-banner-advice')).toHaveTextContent(
      'Account state was modified concurrently',
    );
  });

  it('renders advice for HTTP 429 Rate Limit', () => {
    const appError: AppError = {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many calls',
      traceId: 'trace-429',
      timestamp: '2026-09-23T15:00:00Z',
    };

    render(<DomainErrorBanner error={appError} />);
    expect(screen.getByTestId('error-banner-advice')).toHaveTextContent('Rate limit exceeded');
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    const appError: AppError = {
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid payload',
      traceId: 'N/A',
      timestamp: '2026-09-23T15:00:00Z',
    };

    render(<DomainErrorBanner error={appError} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('error-banner-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('automatically parses standard Error instance', () => {
    render(<DomainErrorBanner error={new Error('Network dropped')} />);

    expect(screen.getByTestId('error-banner-code')).toHaveTextContent('Error SERVER_ERROR');
    expect(screen.getByTestId('error-banner-message')).toHaveTextContent('Network dropped');
  });

  it('displays live countdown for HTTP 429 with retryAfter', () => {
    const appError: AppError = {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
      traceId: 'trace-429-ticker',
      timestamp: '2026-09-25T12:00:00Z',
      retryAfter: 30,
    };

    render(<DomainErrorBanner error={appError} />);
    expect(screen.getByTestId('error-banner-countdown')).toHaveTextContent('Retry available in 30s');
  });

  it('invokes onRetry callback when 409 retry button is clicked', () => {
    const onRetry = vi.fn();
    const appError: AppError = {
      status: 409,
      code: 'CONCURRENT_MODIFICATION',
      message: 'Version collision',
      traceId: 'trace-409',
      timestamp: '2026-09-25T12:00:00Z',
      isOptimisticLock: true,
    };

    render(<DomainErrorBanner error={appError} onRetry={onRetry} />);
    const retryBtn = screen.getByTestId('error-banner-retry-btn');
    expect(retryBtn).toHaveTextContent('Refresh & Retry');

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders field errors list when fieldErrors exist on AppError', () => {
    const appError: AppError = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      traceId: 'trace-400',
      timestamp: '2026-09-25T12:00:00Z',
      fieldErrors: {
        amount: 'Must be greater than 0',
        currency: 'Invalid ISO code',
      },
    };

    render(<DomainErrorBanner error={appError} />);
    expect(screen.getByTestId('error-banner-field-errors')).toBeInTheDocument();
    expect(screen.getByTestId('field-error-amount')).toHaveTextContent('amount: Must be greater than 0');
    expect(screen.getByTestId('field-error-currency')).toHaveTextContent('currency: Invalid ISO code');
  });
});
