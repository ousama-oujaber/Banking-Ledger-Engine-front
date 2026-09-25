import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from './authenticated-shell';
import * as authModule from '../../app/providers';

describe('AuthenticatedShell Component', () => {
  it('renders brand, greeting, navigation links, and logout button', () => {
    const logoutMock = vi.fn();
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: {
        id: 'cust-1',
        name: 'Alice Customer',
        username: 'alice',
        roles: ['CUSTOMER'],
        permissions: [],
        claims: {} as any,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: logoutMock,
    });

    render(
      <MemoryRouter>
        <AuthenticatedShell />
      </MemoryRouter>,
    );

    expect(screen.getByText('Banking Ledger Engine')).toBeInTheDocument();
    expect(screen.getByText('Alice Customer')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-transfers')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-fx')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-beneficiaries')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-statements')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Logout'));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
