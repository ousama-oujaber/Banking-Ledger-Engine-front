import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Currency } from '@ble-frontend/domain-types';
import * as beneficiariesHookModule from './hooks/use-beneficiaries';
import { BeneficiariesPage } from './beneficiaries-page';

describe('BeneficiariesPage Component', () => {
  let queryClient: QueryClient;

  const mockBeneficiaries = [
    {
      id: 'ben-1',
      ownerId: 'cust-1',
      destinationAccountId: 'acc-dest-1',
      name: 'Supplier Alpha',
      currency: Currency.EUR,
      status: 'ACTIVE' as const,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.restoreAllMocks();

    vi.spyOn(beneficiariesHookModule, 'useBeneficiaries').mockReturnValue({
      data: mockBeneficiaries,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(beneficiariesHookModule, 'useCreateBeneficiaryMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);

    vi.spyOn(beneficiariesHookModule, 'useDeleteBeneficiaryMutation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);
  });

  const renderWithRouter = () => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <BeneficiariesPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );
  };

  it('renders BeneficiaryList and opens Add modal', () => {
    renderWithRouter();

    expect(screen.getByTestId('beneficiaries-page')).toBeInTheDocument();
    expect(screen.getByText('Supplier Alpha')).toBeInTheDocument();

    expect(screen.queryByTestId('beneficiary-form-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));
    expect(screen.getByTestId('beneficiary-form-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('beneficiary-form-cancel'));
    expect(screen.queryByTestId('beneficiary-form-modal')).not.toBeInTheDocument();
  });
});
