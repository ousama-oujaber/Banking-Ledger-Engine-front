import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import {
  AuthProvider,
  AppProviders,
  useAuth,
  BruteForceError,
  InvalidCredentialsError,
  createQueryClient,
} from './providers';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

// Helper component to inspect auth context values
function AuthConsumer({ onRender }: { onRender: (ctx: ReturnType<typeof useAuth>) => void }) {
  const ctx = useAuth();
  onRender(ctx);
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="username">{ctx.user?.username ?? 'none'}</span>
      <button onClick={ctx.logout}>Logout</button>
    </div>
  );
}

// Helper component executing a query inside AppProviders
function QueryConsumer() {
  const { data, isLoading } = useQuery({
    queryKey: ['test-balance'],
    queryFn: async () => ({ balance: '1500.00 USD' }),
  });

  if (isLoading) return <div>Loading query...</div>;
  return <div data-testid="query-result">{data?.balance}</div>;
}

describe('AuthProvider & AppProviders (TanStack Query v5)', () => {
  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
    vi.restoreAllMocks();
  });

  it('should start unauthenticated with no token stored', async () => {
    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isLoading).toBe(false);
    });
    expect(captured?.isAuthenticated).toBe(false);
    expect(captured?.user).toBeNull();
  });

  it('should start authenticated when a valid token is already stored', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-01',
      preferred_username: 'alice',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isLoading).toBe(false);
    });
    expect(captured?.isAuthenticated).toBe(true);
    expect(captured?.user?.username).toBe('alice');
  });

  it('should set authenticated state after successful login', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-02',
      preferred_username: 'bob',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: now + 3600,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isLoading).toBe(false);
    });

    await act(async () => {
      await captured!.login('bob', 'password123');
    });

    expect(captured?.isAuthenticated).toBe(true);
    expect(captured?.user?.username).toBe('bob');
  });

  it('should throw InvalidCredentialsError on HTTP 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BAD_CREDENTIALS' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await captured!.login('bad', 'creds');
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should throw BruteForceError with retryAfter on HTTP 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BRUTE_FORCE_BLOCKED', retryAfter: 120 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isLoading).toBe(false);
    });

    let thrownError: unknown;
    try {
      await act(async () => {
        await captured!.login('brute', 'force');
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(BruteForceError);
    expect((thrownError as BruteForceError).retryAfter).toBe(120);
  });

  it('should clear state and reset user on logout', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-03',
      preferred_username: 'carol',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captured?.isAuthenticated).toBe(true);
    });

    act(() => {
      captured!.logout();
    });

    expect(captured?.isAuthenticated).toBe(false);
    expect(captured?.user).toBeNull();
    expect(AuthService.getToken()).toBeNull();
  });

  it('should render children within AppProviders and execute queries', async () => {
    const testQueryClient = createQueryClient();

    render(
      <MemoryRouter>
        <AppProviders queryClient={testQueryClient}>
          <QueryConsumer />
        </AppProviders>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('query-result').textContent).toBe('1500.00 USD');
    });
  });

  it('should purge queryClient cache on logout to prevent data leaks', async () => {
    const testQueryClient = createQueryClient();
    testQueryClient.setQueryData(['sensitive-account-data'], {
      accountNumber: 'ACC-12345',
      balance: 99999,
    });

    let captured: ReturnType<typeof useAuth> | undefined;

    render(
      <MemoryRouter>
        <AppProviders queryClient={testQueryClient}>
          <AuthConsumer
            onRender={(ctx) => {
              captured = ctx;
            }}
          />
        </AppProviders>
      </MemoryRouter>,
    );

    // Verify data exists prior to logout
    expect(testQueryClient.getQueryData(['sensitive-account-data'])).toBeDefined();

    act(() => {
      captured!.logout();
    });

    // Query cache must be completely cleared
    expect(testQueryClient.getQueryData(['sensitive-account-data'])).toBeUndefined();
  });
});
