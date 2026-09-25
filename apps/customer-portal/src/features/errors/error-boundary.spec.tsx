import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ErrorBoundary } from './error-boundary';

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Explosion in test component!');
  }
  return <div data-testid="problem-child-ok">Safe Content</div>;
}

function WrapperWithState() {
  const [hasError, setHasError] = useState(false);
  return (
    <div>
      <button onClick={() => setHasError(true)} data-testid="trigger-error">
        Trigger
      </button>
      <ErrorBoundary>
        <ProblemChild shouldThrow={hasError} />
      </ErrorBoundary>
    </div>
  );
}

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('problem-child-ok')).toBeInTheDocument();
  });

  it('renders default fallback UI when a child crashes', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Explosion in test component!')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-reset-btn')).toBeInTheDocument();
  });

  it('supports custom fallback render prop', () => {
    render(
      <ErrorBoundary
        fallback={(err, reset) => (
          <div data-testid="custom-fallback">
            <span>Custom: {err.message}</span>
            <button onClick={reset} data-testid="custom-reset">
              Reset
            </button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Custom: Explosion in test component!/)).toBeInTheDocument();
  });

  it('calls onError callback when error is captured', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Explosion in test component!' }),
      expect.anything(),
    );
  });
});
