/**
 * Backend error response contract matching the GlobalExceptionHandler envelope.
 */
export interface ErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  traceId: string;
}

export interface AppError {
  status: number;
  code: string;
  message: string;
  traceId: string;
  timestamp: string;
}

export function parseBackendError(error: any): AppError {
  const data = error?.response?.data ?? error;
  return {
    status: error?.response?.status ?? 500,
    code: data?.code ?? 'UNKNOWN_ERROR',
    message: data?.message ?? 'An unexpected network error occurred.',
    traceId: data?.traceId ?? 'N/A',
    timestamp: data?.timestamp ?? new Date().toISOString(),
  };
}
