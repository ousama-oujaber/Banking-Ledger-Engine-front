import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBeneficiaries,
  useCreateBeneficiaryMutation,
  useDeleteBeneficiaryMutation,
} from './hooks/use-beneficiaries';
import { BeneficiaryList } from './components/beneficiary-list';
import { BeneficiaryFormModal } from './components/beneficiary-form-modal';
import { Beneficiary, CreateBeneficiaryCommand } from './types';
import { DomainErrorBanner } from '../errors';

export const BeneficiariesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: beneficiaries = [], isLoading, error: beneficiariesError } = useBeneficiaries();
  const createMutation = useCreateBeneficiaryMutation();
  const deleteMutation = useDeleteBeneficiaryMutation();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeError = beneficiariesError || createMutation.error || deleteMutation.error;

  const handleAddSubmit = async (command: CreateBeneficiaryCommand) => {
    setSuccessMessage(null);
    await createMutation.mutateAsync(command);
    setIsAddModalOpen(false);
    setSuccessMessage(`Beneficiary "${command.name}" added successfully.`);
  };

  const handleDelete = async (beneficiary: Beneficiary) => {
    if (window.confirm(`Are you sure you want to remove ${beneficiary.name}?`)) {
      setSuccessMessage(null);
      await deleteMutation.mutateAsync(beneficiary.id);
      setSuccessMessage(`Beneficiary "${beneficiary.name}" removed.`);
    }
  };

  const handleSelectForTransfer = (beneficiary: Beneficiary) => {
    navigate('/transfers', {
      state: { destinationAccountId: beneficiary.destinationAccountId },
    });
  };

  return (
    <div className="beneficiaries-page" data-testid="beneficiaries-page">
      {activeError && (
        <DomainErrorBanner
          error={activeError}
          onDismiss={() => {
            createMutation.reset();
            deleteMutation.reset();
          }}
        />
      )}

      {successMessage && (
        <div
          className="alert alert--success"
          role="status"
          data-testid="beneficiaries-success-message"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert__close-btn"
            onClick={() => setSuccessMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      <main className="beneficiaries-page__content">
        <BeneficiaryList
          beneficiaries={beneficiaries}
          isLoading={isLoading}
          onAddClick={() => setIsAddModalOpen(true)}
          onDeleteClick={handleDelete}
          onSelectForTransfer={handleSelectForTransfer}
        />
      </main>

      <BeneficiaryFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        isSubmitting={createMutation.isPending}
        serverError={createMutation.error ? (createMutation.error as any).message : null}
      />
    </div>
  );
};
