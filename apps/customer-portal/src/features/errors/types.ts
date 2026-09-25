import type { ApiError } from '@ble-frontend/api-client';

export interface AppError {
  status: number;
  code: string;
  message: string;
  traceId: string;
  timestamp: string;
  retryAfter?: number;
  isOptimisticLock?: boolean;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
}

export function parseBackendError(error: unknown): AppError {
  const now = new Date().toISOString();

  if (!error) {
    return {
      status: 500,
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred.',
      traceId: 'N/A',
      timestamp: now,
    };
  }

  if (typeof error === 'string') {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: error,
      traceId: 'N/A',
      timestamp: now,
    };
  }

  // Handle openapi-typescript-codegen ApiError
  const apiErr = error as Partial<ApiError> & {
    response?: {
      status?: number;
      data?: {
        code?: string;
        message?: string;
        traceId?: string;
        retryAfter?: number;
        fieldErrors?: Record<string, string>;
        details?: Record<string, unknown>;
      };
      headers?: Record<string, string>;
    };
    body?: {
      code?: string;
      message?: string;
      traceId?: string;
      retryAfter?: number;
      fieldErrors?: Record<string, string>;
      details?: Record<string, unknown>;
    };
  };

  const status = apiErr.status ?? apiErr.response?.status ?? 500;
  const body = apiErr.body ?? apiErr.response?.data;
  const headers = apiErr.response?.headers;
  const headerTraceId = headers?.['x-trace-id'];
  const traceId = body?.traceId || headerTraceId || 'N/A';
  const rawCode = body?.code;

  let retryAfter = body?.retryAfter;
  if (retryAfter === undefined && headers?.['retry-after']) {
    const parsedHeader = parseInt(headers['retry-after'], 10);
    if (!isNaN(parsedHeader)) {
      retryAfter = parsedHeader;
    }
  }

  let code = rawCode || 'SERVER_ERROR';
  let message =
    body?.message || (error instanceof Error ? error.message : 'An unexpected error occurred.');

  if (status === 409) {
    code = rawCode || 'CONCURRENT_MODIFICATION';
    if (!body?.message) {
      message =
        'Account balance was updated in another session. Please review the updated balance and retry.';
    }
  } else if (status === 429) {
    code = rawCode || 'RATE_LIMIT_EXCEEDED';
    if (!body?.message) {
      message = 'Rate limit exceeded. Please wait a moment before trying again.';
    }
  } else if (status === 422) {
    code = rawCode || 'UNPROCESSABLE_ENTITY';
  } else if (status === 404) {
    code = rawCode || 'NOT_FOUND';
  } else if (status === 403) {
    code = rawCode || 'FORBIDDEN';
  } else if (status === 401) {
    code = rawCode || 'UNAUTHORIZED';
  }

  const isOptimisticLock = status === 409 || code === 'CONCURRENT_MODIFICATION';

  return {
    status,
    code,
    message,
    traceId,
    timestamp: now,
    retryAfter,
    isOptimisticLock: isOptimisticLock || undefined,
    fieldErrors: body?.fieldErrors,
    details: body?.details,
  };
}
