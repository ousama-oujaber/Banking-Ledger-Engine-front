import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

/**
 * Custom retry decider for financial applications.
 * - Business/client errors (4xx) should never be automatically retried.
 * - Network drops or 5xx server errors can be retried up to 2 times with backoff.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }

  // Extract HTTP status if present on error object
  const status =
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status ??
    (error as { statusCode?: number })?.statusCode;

  if (typeof status === 'number') {
    // 4xx client errors (400, 401, 403, 404, 409, 422, 429) must not be retried
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a pre-configured QueryClient instance with financial caching defaults.
 */
export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000, // 10s: financial balances & feeds stay fresh
        gcTime: 5 * 60_000, // 5m: retain inactive cache entries
        refetchOnWindowFocus: true, // ensure freshest balances when returning to tab
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false, // financial mutations (transfers, deposits) must not blindly retry
      },
      ...config?.defaultOptions,
    },
    ...config,
  });
}

/**
 * Global QueryClient instance for apps/customer-portal.
 */
export const queryClient = createQueryClient();
