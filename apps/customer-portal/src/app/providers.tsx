import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AuthService, AuthUser } from '@ble-frontend/auth';
import { useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from './query-client';

export * from './query-client';
export * from './query-keys';

// ── Typed Login Errors ──────────────────────────────────────────────────────

export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid username or password.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class BruteForceError extends Error {
  public readonly retryAfter: number; // seconds

  constructor(retryAfter: number, message?: string) {
    super(message ?? `Too many attempts. Try again in ${retryAfter} seconds.`);
    this.name = 'BruteForceError';
    this.retryAfter = retryAfter;
  }
}

export class LoginError extends Error {
  constructor(message = 'An unexpected error occurred during login.') {
    super(message);
    this.name = 'LoginError';
  }
}

// ── Auth Context ────────────────────────────────────────────────────────────

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ── Auth Provider ───────────────────────────────────────────────────────────

export interface AuthProviderProps {
  children: ReactNode;
  /** Optional custom QueryClient for testing or isolation */
  queryClient?: QueryClient;
}

export function AuthProvider({ children, queryClient = defaultQueryClient }: AuthProviderProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Sync auth state from the token on mount + subscribe to external changes
  useEffect(() => {
    const syncState = () => {
      const token = AuthService.getToken();
      const valid = !!token && !AuthService.isTokenExpired();
      setIsAuthenticated(valid);
      setUser(valid ? AuthService.getUser() : null);
    };

    syncState();
    setIsLoading(false);

    const unsubscribe = AuthService.subscribe(() => {
      syncState();
    });

    return unsubscribe;
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const response = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          let retryAfter = 300; // default 5 minutes
          const retryHeader = response.headers.get('Retry-After');
          if (retryHeader) {
            const parsed = parseInt(retryHeader, 10);
            if (!isNaN(parsed) && parsed > 0) {
              retryAfter = parsed;
            }
          } else {
            try {
              const body = await response.json();
              if (typeof body.retryAfter === 'number' && body.retryAfter > 0) {
                retryAfter = body.retryAfter;
              }
            } catch {
              // ignore parse failure, use default
            }
          }
          throw new BruteForceError(retryAfter);
        }

        if (response.status === 401) {
          throw new InvalidCredentialsError();
        }

        // Generic server error
        let message = 'Login failed. Please try again.';
        try {
          const body = await response.json();
          if (body.message) {
            message = body.message;
          }
        } catch {
          // ignore parse failure
        }
        throw new LoginError(message);
      }

      const data = await response.json();
      AuthService.setToken(data.token);
      setIsAuthenticated(true);
      setUser(AuthService.getUser());
      navigate('/');
    },
    [navigate],
  );

  const logout = useCallback(() => {
    AuthService.clear();
    // Security: purge all cached queries so financial data never leaks between sessions
    queryClient.cancelQueries();
    queryClient.clear();
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
  }, [navigate, queryClient]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── App Providers (Combines QueryClientProvider & AuthProvider) ──────────────

export interface AppProvidersProps {
  children: ReactNode;
  /** Optional custom QueryClient for isolated tests */
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient = defaultQueryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider queryClient={queryClient}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
