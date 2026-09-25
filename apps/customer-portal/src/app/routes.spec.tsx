import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import * as authModule from './providers';
import { AppRoutes } from './routes';
import * as accountsHookModule from '../features/accounts/hooks/use-accounts';
import * as fxHookModule from '../features/fx/hooks/use-fx';
import * as beneficiariesHookModule from '../features/beneficiaries/hooks/use-beneficiaries';
import * as transactionsHookModule from '../features/transactions/hooks/use-transactions';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('AppRoutes navigation integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
    vi.restoreAllMocks();

    vi.spyOn(accountsHookModule, 'useAccounts').mockReturnValue({
      accounts: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(fxHookModule, 'useFxRates').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(beneficiariesHookModule, 'useBeneficiaries').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(transactionsHookModule, 'useTransactions').mockReturnValue({
      transactions: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      page: 1,
      hasMore: false,
      loadMore: vi.fn(),
      resetPagination: vi.fn(),
    } as any);
  });

  const renderRoute = (initialPath: string, isAuthenticated = true) => {
    if (isAuthenticated) {
      const token = createMockToken({
        sub: 'cust-1',
        preferred_username: 'alice',
        roles: ['CUSTOMER'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      AuthService.setToken(token);
    } else {
      AuthService.clear();
    }

    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: isAuthenticated
        ? {
            id: 'cust-1',
            name: 'Alice Customer',
            username: 'alice',
            roles: ['CUSTOMER'],
            permissions: [],
            claims: {} as any,
          }
        : null,
      isAuthenticated,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <QueryClientProvider client={queryClient}>
          <AppRoutes />
        </QueryClientProvider>
      </MemoryRouter>,
    );
  };

  it('renders dashboard at /', () => {
    renderRoute('/');
    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument();
  });

  it('renders transfers page at /transfers', () => {
    renderRoute('/transfers');
    expect(screen.getByTestId('transfers-page')).toBeInTheDocument();
  });

  it('renders fx page at /fx', () => {
    renderRoute('/fx');
    expect(screen.getByTestId('fx-page')).toBeInTheDocument();
  });

  it('renders beneficiaries page at /beneficiaries', () => {
    renderRoute('/beneficiaries');
    expect(screen.getByTestId('beneficiaries-page')).toBeInTheDocument();
  });

  it('renders statements page at /statements', () => {
    renderRoute('/statements');
    expect(screen.getByTestId('statements-page')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    renderRoute('/transfers', false);
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('renders 404 page for unknown routes with back navigation', () => {
    renderRoute('/unknown-invalid-route-123');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-back-btn')).toBeInTheDocument();
  });
});
