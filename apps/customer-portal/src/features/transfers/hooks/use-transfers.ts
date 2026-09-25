import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  transfer,
  deposit,
  withdraw,
  type TransactionResponse,
  type ApiError,
} from '@ble-frontend/api-client';
import { isOptimisticLockError } from '@ble-frontend/domain-types';
import { queryKeys } from '../../../app/query-keys';
import { generateIdempotencyKey } from '../idempotency';
import type { TransferCommand, DepositCommand, WithdrawCommand } from '../types';

export interface TransferMutationParams {
  command: TransferCommand;
  idempotencyKey?: string;
}

export interface DepositMutationParams {
  command: DepositCommand;
  idempotencyKey?: string;
}

export interface WithdrawMutationParams {
  command: WithdrawCommand;
  idempotencyKey?: string;
}

/**
 * Mutation hook for intra-bank double-entry transfers (S3-T1, S3-T2).
 * Enforces client idempotency key generation and automatic 409 retry with identical key.
 */
export function useTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, Error | ApiError, TransferMutationParams>({
    mutationFn: async ({ command, idempotencyKey = generateIdempotencyKey() }) => {
      const executeRequest = async (key: string): Promise<TransactionResponse> => {
        return (await transfer({
          idempotencyKey: key,
          requestBody: {
            fromAccountId: command.fromAccountId,
            toAccountId: command.toAccountId,
            amount: {
              amount: command.amount.amount.toNumber(),
              currency: command.amount.currency as any,
            },
            reference: command.reference,
            description: command.description,
            beneficiaryId: command.beneficiaryId,
          },
        })) as TransactionResponse;
      };

      try {
        return await executeRequest(idempotencyKey);
      } catch (err) {
        // If concurrent modification / optimistic lock conflict, retry once with SAME key
        if (isOptimisticLockError(err)) {
          // Wait 300ms backoff
          await new Promise((resolve) => setTimeout(resolve, 300));
          return await executeRequest(idempotencyKey);
        }
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate both accounts overview and transaction feeds
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

/**
 * Mutation hook for deposit operations (FR-CUST-TX-02).
 */
export function useDepositMutation() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, Error | ApiError, DepositMutationParams>({
    mutationFn: async ({ command, idempotencyKey = generateIdempotencyKey() }) => {
      return (await deposit({
        id: command.accountId,
        idempotencyKey,
        requestBody: {
          amount: {
            amount: command.amount.amount.toNumber(),
            currency: command.amount.currency as any,
          },
          reference: command.reference,
          description: command.description,
        },
      })) as TransactionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

/**
 * Mutation hook for withdrawal operations (FR-CUST-TX-02).
 */
export function useWithdrawMutation() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, Error | ApiError, WithdrawMutationParams>({
    mutationFn: async ({ command, idempotencyKey = generateIdempotencyKey() }) => {
      return (await withdraw({
        id: command.accountId,
        idempotencyKey,
        requestBody: {
          amount: {
            amount: command.amount.amount.toNumber(),
            currency: command.amount.currency as any,
          },
          reference: command.reference,
          description: command.description,
        },
      })) as TransactionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
