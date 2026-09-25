import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Currency } from '@ble-frontend/domain-types';
import { BeneficiaryList } from './beneficiary-list';
import { Beneficiary } from '../types';

describe('BeneficiaryList Component', () => {
  const mockBeneficiaries: Beneficiary[] = [
    {
      id: 'ben-1',
      ownerId: 'cust-1',
      destinationAccountId: 'acc-dest-1',
      name: 'Alice Johnson',
      currency: Currency.EUR,
      iban: 'FR7630006000011234567890189',
      status: 'ACTIVE',
    },
    {
      id: 'ben-2',
      ownerId: 'cust-1',
      destinationAccountId: 'acc-dest-2',
      name: 'Bob Supplier',
      currency: Currency.USD,
      status: 'BLOCKED',
      blockReason: 'Suspected AML',
    },
  ];

  it('renders loading state', () => {
    render(
      <BeneficiaryList
        beneficiaries={[]}
        isLoading={true}
        onAddClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('beneficiaries-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading beneficiaries...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <BeneficiaryList
        beneficiaries={[]}
        error={new Error('Network error')}
        onAddClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('beneficiaries-error')).toBeInTheDocument();
    expect(screen.getByText(/Failed to load beneficiaries: Network error/)).toBeInTheDocument();
  });

  it('renders empty state when no beneficiaries exist', () => {
    render(<BeneficiaryList beneficiaries={[]} onAddClick={vi.fn()} onDeleteClick={vi.fn()} />);
    expect(screen.getByTestId('beneficiaries-empty')).toBeInTheDocument();
    expect(screen.getByText(/No beneficiaries found/)).toBeInTheDocument();
  });

  it('renders list with table rows, status badges, and actions', () => {
    const onAddClick = vi.fn();
    const onDeleteClick = vi.fn();
    const onSelectForTransfer = vi.fn();

    render(
      <BeneficiaryList
        beneficiaries={mockBeneficiaries}
        onAddClick={onAddClick}
        onDeleteClick={onDeleteClick}
        onSelectForTransfer={onSelectForTransfer}
      />,
    );

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Supplier')).toBeInTheDocument();
    expect(screen.getByTestId('badge-status-ben-1')).toHaveTextContent('ACTIVE');
    expect(screen.getByTestId('badge-status-ben-2')).toHaveTextContent('BLOCKED');

    // Transfer button only present for ACTIVE
    expect(screen.getByTestId('transfer-to-ben-1')).toBeInTheDocument();
    expect(screen.queryByTestId('transfer-to-ben-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('transfer-to-ben-1'));
    expect(onSelectForTransfer).toHaveBeenCalledWith(mockBeneficiaries[0]);

    fireEvent.click(screen.getByTestId('delete-beneficiary-ben-2'));
    expect(onDeleteClick).toHaveBeenCalledWith(mockBeneficiaries[1]);

    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('filters list by search term', () => {
    render(
      <BeneficiaryList
        beneficiaries={mockBeneficiaries}
        onAddClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const searchInput = screen.getByTestId('beneficiary-search-input');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Supplier')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });
    expect(screen.getByText(/No beneficiaries matching your filter/)).toBeInTheDocument();
  });
});
