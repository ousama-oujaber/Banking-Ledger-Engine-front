import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { ProtectedRoute } from './protected-route';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
  });

  it('should redirect to /login when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div data-testid="login">Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login')).toBeDefined();
    expect(screen.queryByTestId('protected')).toBeNull();
  });

  it('should render children when authenticated without role requirement', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'user-01',
      preferred_username: 'test',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div data-testid="login">Login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected')).toBeDefined();
    expect(screen.queryByTestId('login')).toBeNull();
  });

  it('should redirect to /access-denied when role requirement is not met', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'user-02',
      preferred_username: 'operator',
      roles: ['OPERATOR'],
      permissions: [],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/access-denied" element={<div data-testid="denied">Denied</div>} />
          <Route path="/login" element={<div data-testid="login">Login</div>} />
          <Route element={<ProtectedRoute requiredRoles={['CUSTOMER']} />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('denied')).toBeDefined();
    expect(screen.queryByTestId('protected')).toBeNull();
  });

  it('should render children when role requirement is met', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-01',
      preferred_username: 'alice',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/access-denied" element={<div data-testid="denied">Denied</div>} />
          <Route element={<ProtectedRoute requiredRoles={['CUSTOMER']} />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected')).toBeDefined();
    expect(screen.queryByTestId('denied')).toBeNull();
  });

  it('should support custom redirect path', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/custom-login" element={<div data-testid="custom-login">Custom</div>} />
          <Route element={<ProtectedRoute redirectTo="/custom-login" />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-login')).toBeDefined();
    expect(screen.queryByTestId('protected')).toBeNull();
  });
});
