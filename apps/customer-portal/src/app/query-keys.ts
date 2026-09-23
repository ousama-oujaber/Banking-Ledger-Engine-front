/**
 * Hierarchical Query Key Factory for customer-portal server state.
 * Ensures consistent cache invalidation and query deduplication across hooks.
 */
export const queryKeys = {
  accounts: {
    all: ['accounts'] as const,
    lists: () => [...queryKeys.accounts.all, 'list'] as const,
    list: (customerId?: string) => [...queryKeys.accounts.lists(), { customerId }] as const,
    details: () => [...queryKeys.accounts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
    balanceAt: (id: string, timestamp: string) =>
      [...queryKeys.accounts.detail(id), 'balance-at', timestamp] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    lists: () => [...queryKeys.transactions.all, 'list'] as const,
    list: (accountId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.transactions.lists(), { accountId, ...filters }] as const,
    details: () => [...queryKeys.transactions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.transactions.details(), id] as const,
  },
  fx: {
    all: ['fx'] as const,
    rates: () => [...queryKeys.fx.all, 'rates'] as const,
    quote: (fromCurrency: string, toCurrency: string, amount: string) =>
      [...queryKeys.fx.all, 'quote', { fromCurrency, toCurrency, amount }] as const,
  },
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: (customerId?: string) =>
      [...queryKeys.beneficiaries.all, 'list', { customerId }] as const,
  },
};
