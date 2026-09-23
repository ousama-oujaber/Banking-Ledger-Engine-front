import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { AuthProvider } from '../../app/providers';
import { LoginPage } from './login-page';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
    vi.restoreAllMocks();
  });

  it('should render login form with username, password, and submit button', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: /login/i })).toBeDefined();
    expect(screen.getByText('Banking Ledger Engine')).toBeDefined();
  });

  it('should display "Invalid username or password" on 401 error', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BAD_CREDENTIALS' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText('Username'), 'bad');
    await user.type(screen.getByPlaceholderText('Password'), 'creds');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password.')).toBeDefined();
    });
  });

  it('should display lockout message and disable form on 429 error', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BRUTE_FORCE_BLOCKED', retryAfter: 60 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText('Username'), 'brute');
    await user.type(screen.getByPlaceholderText('Password'), 'force');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    // Form inputs should be disabled
    expect(screen.getByPlaceholderText('Username')).toHaveProperty('disabled', true);
    expect(screen.getByPlaceholderText('Password')).toHaveProperty('disabled', true);

    // Submit button should show 'Locked'
    const submitBtn = screen.getByRole('button', { name: /locked/i });
    expect(submitBtn).toBeDefined();
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('should call login and navigate on successful submission', async () => {
    const user = userEvent.setup();

    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-01',
      preferred_username: 'alice',
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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'pass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(AuthService.getToken()).toBe(token);
    });
  });
});
