/**
 * Field-level validation error contract matching backend Bean Validation / Spring MethodArgumentNotValidException.
 */
export interface FieldError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

/**
 * Backend error response contract matching the Spring Boot GlobalExceptionHandler envelope.
 */
export interface ErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  traceId: string;
  fieldErrors?: Array<FieldError>;
  details?: Record<string, unknown>;
}

/**
 * Normalized UI application error interface.
 */
export interface AppError {
  status: number;
  code: string;
  message: string;
  traceId: string;
  timestamp: string;
  fieldErrors?: Array<FieldError>;
  isNetworkError?: boolean;
}

/**
 * Base domain exception representing business rule violations in the client domain.
 */
export class DomainException extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;
  readonly timestamp: string;

  constructor(message: string, code = 'DOMAIN_ERROR', status = 400, traceId?: string) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation is attempted between two incompatible currencies.
 */
export class CurrencyMismatchException extends DomainException {
  constructor(baseCurrency: string, targetCurrency: string) {
    super(
      `Currency mismatch: cannot operate on ${baseCurrency.toUpperCase()} and ${targetCurrency.toUpperCase()}`,
      'CURRENCY_MISMATCH',
      422,
    );
    this.name = 'CurrencyMismatchException';
  }
}

/**
 * Thrown when an invalid, non-finite, or negative amount is provided where disallowed.
 */
export class InvalidAmountException extends DomainException {
  constructor(message = 'Amount must be a finite, valid number') {
    super(message, 'INVALID_AMOUNT', 422);
    this.name = 'InvalidAmountException';
  }
}

/**
 * Safely parses any backend, HTTP, Axios, or Fetch error into a strongly-typed AppError.
 * Extracts `traceId` for distributed trace correlation and observability.
 */
export function parseBackendError(error: unknown): AppError {
  if (!error) {
    return {
      status: 500,
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred.',
      traceId: 'N/A',
      timestamp: new Date().toISOString(),
    };
  }

  const err = error as Record<string, any>;

  // Check if it's already an AppError
  if (
    typeof err.status === 'number' &&
    typeof err.code === 'string' &&
    typeof err.message === 'string' &&
    typeof err.traceId === 'string'
  ) {
    return err as AppError;
  }

  // Check if it's a DomainException
  if (error instanceof DomainException) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      traceId: error.traceId ?? 'N/A',
      timestamp: error.timestamp,
    };
  }

  // Axios or standard HTTP response error extraction
  const response = err.response;
  const data = response?.data ?? err.body ?? err.data;
  const status = response?.status ?? err.status ?? (err.code === 'ERR_NETWORK' ? 0 : 500);
  const isNetwork =
    status === 0 || err.code === 'ERR_NETWORK' || (!response && Boolean(err.request));

  const code = isNetwork
    ? 'NETWORK_ERROR'
    : (data?.code ?? err.code ?? (status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'));

  const message =
    data?.message ??
    err.message ??
    (isNetwork
      ? 'Network connection failure. Please verify connectivity.'
      : 'An unexpected error occurred.');

  const traceId = data?.traceId ?? err.traceId ?? response?.headers?.['x-trace-id'] ?? 'N/A';
  const timestamp = data?.timestamp ?? new Date().toISOString();
  const fieldErrors = Array.isArray(data?.fieldErrors) ? data.fieldErrors : undefined;

  return {
    status,
    code,
    message,
    traceId,
    timestamp,
    fieldErrors,
    isNetworkError: isNetwork,
  };
}

/**
 * Predicate to check if an error represents insufficient funds.
 */
export function isInsufficientFundsError(error: unknown): boolean {
  const parsed = parseBackendError(error);
  return (
    parsed.code === 'INSUFFICIENT_FUNDS' ||
    (parsed.status === 422 && parsed.code.includes('INSUFFICIENT'))
  );
}

/**
 * Predicate to check if an error is due to a frozen account.
 */
export function isAccountFrozenError(error: unknown): boolean {
  const parsed = parseBackendError(error);
  return parsed.code === 'ACCOUNT_FROZEN' || parsed.code === 'ACCOUNT_NOT_ACTIVE';
}

/**
 * Predicate to check if an error is an optimistic lock conflict (HTTP 409).
 */
export function isOptimisticLockError(error: unknown): boolean {
  const parsed = parseBackendError(error);
  return (
    parsed.status === 409 ||
    parsed.code === 'CONCURRENT_MODIFICATION' ||
    parsed.code === 'OPTIMISTIC_LOCK_CONFLICT'
  );
}

/**
 * Predicate to check if an error is an idempotency key conflict.
 */
export function isIdempotencyConflictError(error: unknown): boolean {
  const parsed = parseBackendError(error);
  return parsed.code === 'IDEMPOTENCY_CONFLICT' || parsed.code === 'DUPLICATE_IDEMPOTENCY_KEY';
}
