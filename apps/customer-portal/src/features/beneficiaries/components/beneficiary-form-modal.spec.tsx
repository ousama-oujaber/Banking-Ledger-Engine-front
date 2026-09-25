import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Currency } from '@ble-frontend/domain-types';
import { BeneficiaryFormModal } from './beneficiary-form-modal';

describe('BeneficiaryFormModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <BeneficiaryFormModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when isOpen is true', () => {
    render(<BeneficiaryFormModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('beneficiary-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Add New Beneficiary')).toBeInTheDocument();
  });

  it('validates required fields before submitting', async () => {
    const onSubmit = vi.fn();
    render(<BeneficiaryFormModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('beneficiary-form-submit'));

    expect(await screen.findByText('Beneficiary name is required')).toBeInTheDocument();
    expect(screen.getByText('Destination account ID is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates IBAN format if provided', async () => {
    const onSubmit = vi.fn();
    render(<BeneficiaryFormModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('beneficiary-name-input'), {
      target: { value: 'Valid Name' },
    });
    fireEvent.change(screen.getByTestId('beneficiary-account-id-input'), {
      target: { value: 'acc-123' },
    });
    fireEvent.change(screen.getByTestId('beneficiary-iban-input'), {
      target: { value: 'invalid_iban' },
    });

    fireEvent.click(screen.getByTestId('beneficiary-form-submit'));

    expect(await screen.findByText('Invalid IBAN format')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid data successfully and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<BeneficiaryFormModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('beneficiary-name-input'), {
      target: { value: 'Valid Name' },
    });
    fireEvent.change(screen.getByTestId('beneficiary-account-id-input'), {
      target: { value: 'acc-123' },
    });
    fireEvent.change(screen.getByTestId('beneficiary-currency-select'), {
      target: { value: Currency.USD },
    });
    fireEvent.change(screen.getByTestId('beneficiary-iban-input'), {
      target: { value: 'GB29NWBK60161331926819' },
    });

    fireEvent.click(screen.getByTestId('beneficiary-form-submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Valid Name',
        destinationAccountId: 'acc-123',
        currency: Currency.USD,
        iban: 'GB29NWBK60161331926819',
      });
    });
  });

  it('displays server error if provided', () => {
    render(
      <BeneficiaryFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        serverError="Account does not exist"
      />,
    );

    expect(screen.getByTestId('beneficiary-server-error')).toHaveTextContent(
      'Account does not exist',
    );
  });
});
