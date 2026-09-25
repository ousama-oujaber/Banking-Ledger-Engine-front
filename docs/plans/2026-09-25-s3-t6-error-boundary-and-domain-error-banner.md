# S3-T6: Error Boundary & Domain Error Banner Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full enterprise error resilience across `customer-portal` in compliance with FR-CUST-TX, NFR-5.4, and Section 6 of the specifications by enhancing `ErrorBoundary`, upgrading `DomainErrorBanner` with active 429 countdown and 409 retry handlers, and integrating standardized domain error handling across all financial flows.

**Architecture:** A dual-tier error handling architecture: (1) React Error Boundaries at root and feature-shell boundaries for unhandled render and routing exceptions with session logging; (2) Semantic `DomainErrorBanner` adhering to the backend's `ErrorResponse` contract (`code`, `message`, `traceId`, `timestamp`, `retryAfter`) with tailored behaviors for HTTP 400, 403, 404, 409, 422, 429, and 500.

**Tech Stack:** React 19, TypeScript 5.6+, `@ble-frontend/domain-types`, TanStack Query v5, Vitest, Testing Library.

---

### Task 1: Domain Error Taxonomy & Types Enhancement

**Files:**

- Modify: `apps/customer-portal/src/features/errors/types.ts`
- Test: `apps/customer-portal/src/features/errors/types.spec.ts`

**Step 1: Write the failing test**
Add tests asserting:

- `parseBackendError` extracts `retryAfter` (from seconds number or header string) for HTTP 429.
- `parseBackendError` preserves `isConcurrentModification` flag for HTTP 409.
- `parseBackendError` handles Spring Boot field validation error arrays (`fieldErrors`).

```typescript
it('extracts retryAfter seconds for 429 Too Many Requests', () => {
  const axiosError = {
    response: {
      status: 429,
      headers: { 'retry-after': '30' },
      data: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        traceId: 'trace-429',
      },
    },
  };
  const parsed = parseBackendError(axiosError);
  expect(parsed.status).toBe(429);
  expect(parsed.retryAfter).toBe(30);
});

it('flags concurrent modification for 409 Conflict', () => {
  const axiosError = {
    response: {
      status: 409,
      data: {
        code: 'CONCURRENT_MODIFICATION',
        message: 'Optimistic lock failure',
        traceId: 'trace-409',
      },
    },
  };
  const parsed = parseBackendError(axiosError);
  expect(parsed.status).toBe(409);
  expect(parsed.isOptimisticLock).toBe(true);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm nx test customer-portal -t "types.spec.ts"`
Expected: FAIL due to missing `retryAfter` and `isOptimisticLock` properties on `AppError`.

**Step 3: Implement minimal code in `types.ts`**

- Extend `AppError` interface:
  - `retryAfter?: number;`
  - `isOptimisticLock?: boolean;`
  - `fieldErrors?: Record<string, string>;`
- Update `parseBackendError` to parse `headers['retry-after']` or `data.retryAfter`.
- Set `isOptimisticLock: true` when status === 409 or code === 'CONCURRENT_MODIFICATION'.

**Step 4: Run test to verify it passes**
Run: `pnpm nx test customer-portal -t "types.spec.ts"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/customer-portal/src/features/errors/types.ts apps/customer-portal/src/features/errors/types.spec.ts
git commit -m "feat(customer-portal): extend error taxonomy with 429 retry-after and 409 optimistic lock detection"
```

---

### Task 2: Upgrade `DomainErrorBanner` with 429 Countdown & 409 Refresh Action

**Files:**

- Modify: `apps/customer-portal/src/features/errors/domain-error-banner.tsx`
- Test: `apps/customer-portal/src/features/errors/domain-error-banner.spec.tsx`

**Step 1: Write the failing test**
Add tests asserting:

- Renders an active countdown ticker when `appError.status === 429` and `retryAfter` is provided.
- Disables or triggers `onRetry` callback when retry button is clicked on 409 Conflict.
- Displays copyable `traceId` button and toggles "Copied!" feedback.

```typescript
it('displays live countdown for HTTP 429 with retryAfter', async () => {
  const error: AppError = {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests',
    status: 429,
    timestamp: '2026-09-25T12:00:00Z',
    traceId: 'trace-429',
    retryAfter: 5,
  };
  render(<DomainErrorBanner error={error} />);
  expect(screen.getByTestId('error-banner-countdown')).toHaveTextContent('Retry available in 5s');
});

it('invokes onRetry callback when 409 retry button is clicked', () => {
  const onRetry = vi.fn();
  const error: AppError = {
    code: 'CONCURRENT_MODIFICATION',
    message: 'Data changed',
    status: 409,
    timestamp: '2026-09-25T12:00:00Z',
    traceId: 'trace-409',
    isOptimisticLock: true,
  };
  render(<DomainErrorBanner error={error} onRetry={onRetry} />);
  fireEvent.click(screen.getByTestId('error-banner-retry-btn'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm nx test customer-portal -t "domain-error-banner.spec.tsx"`
Expected: FAIL due to missing countdown element and retry button.

**Step 3: Implement minimal code in `domain-error-banner.tsx`**

- Accept `onRetry?: () => void;` prop.
- If `appError.status === 429 && appError.retryAfter`, manage an interval ticker:
  `const [secondsLeft, setSecondsLeft] = useState(appError.retryAfter);`
  Decrement each second until 0.
- When `appError.status === 409 && onRetry`, display action button "Refresh & Retry".
- Render semantic alert styling:
  - `.domain-error-banner--warning` for 409 and 422
  - `.domain-error-banner--rate-limit` for 429
  - `.domain-error-banner--danger` for 500

**Step 4: Run test to verify it passes**
Run: `pnpm nx test customer-portal -t "domain-error-banner.spec.tsx"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/customer-portal/src/features/errors/domain-error-banner.tsx apps/customer-portal/src/features/errors/domain-error-banner.spec.tsx
git commit -m "feat(customer-portal): add 429 countdown ticker and 409 retry trigger to DomainErrorBanner"
```

---

### Task 3: Root & Shell Error Boundaries with Session Telemetry Logging

**Files:**

- Modify: `apps/customer-portal/src/features/errors/error-boundary.tsx`
- Modify: `apps/customer-portal/src/app/routes.tsx`
- Create: `apps/customer-portal/src/features/shell/not-found-page.tsx`
- Test: `apps/customer-portal/src/features/errors/error-boundary.spec.tsx`
- Test: `apps/customer-portal/src/app/routes.spec.tsx`

**Step 1: Write the failing test**
Add tests asserting:

- `ErrorBoundary` logs uncaught errors with `[ErrorBoundary] Uncaught UI render error:` and error info.
- `AppRoutes` wraps all route rendering in a root `ErrorBoundary`.
- Unmatched paths render `NotFoundPage` with a "Back to Dashboard" button instead of silent redirect.

```typescript
it('renders 404 page for unknown routes with back navigation', () => {
  renderWithProviders(<AppRoutes />, { initialRoute: '/non-existent-page' });
  expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  expect(screen.getByTestId('not-found-back-btn')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm nx test customer-portal -t "routes.spec.tsx"`
Expected: FAIL due to missing `NotFoundPage`.

**Step 3: Implement code**

- Create `NotFoundPage` (`apps/customer-portal/src/features/shell/not-found-page.tsx`) with friendly message, error graphic, and "Return to Dashboard" link.
- In `apps/customer-portal/src/app/routes.tsx`:
  - Wrap the entire route tree inside `<ErrorBoundary>`.
  - Replace `<Route path="*" element={<Navigate to="/" replace />} />` with `<Route path="*" element={<NotFoundPage />} />`.
- Enhance `ErrorBoundary.componentDidCatch` to include console logging with timestamp and user ID if available.

**Step 4: Run test to verify it passes**
Run: `pnpm nx test customer-portal -t "routes.spec.tsx"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/customer-portal/src/features/errors/error-boundary.tsx apps/customer-portal/src/features/shell/not-found-page.tsx apps/customer-portal/src/app/routes.tsx apps/customer-portal/src/app/routes.spec.tsx
git commit -m "feat(customer-portal): integrate root error boundary and 404 Not Found destination"
```

---

### Task 4: Standardize DomainErrorBanner Integration in Transfers & Cash Ops

**Files:**

- Modify: `apps/customer-portal/src/features/transfers/components/transfer-form.tsx`
- Modify: `apps/customer-portal/src/features/transfers/components/deposit-withdraw-modal.tsx`
- Test: `apps/customer-portal/src/features/transfers/components/transfer-form.spec.tsx`
- Test: `apps/customer-portal/src/features/transfers/components/deposit-withdraw-modal.spec.tsx`

**Step 1: Write the failing test**
Update `transfer-form.spec.tsx` and `deposit-withdraw-modal.spec.tsx` to assert that errors render via `DomainErrorBanner` (checking `data-testid="domain-error-banner"`):

```typescript
it('renders server rejection through DomainErrorBanner with trace ID and retry', async () => {
  // Mock transfer mutation rejection with 422 InsufficientFundsException
  server.use(
    http.post('/api/v1/transfers', () => {
      return HttpResponse.json(
        {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Account acc-1 has insufficient balance',
          traceId: 'trace-transfer-fail',
          timestamp: '2026-09-25T12:00:00Z',
        },
        { status: 422 },
      );
    }),
  );

  render(<TransferForm />);
  // Fill form and submit...
  expect(await screen.findByTestId('domain-error-banner')).toBeInTheDocument();
  expect(screen.getByTestId('error-banner-code')).toHaveTextContent('INSUFFICIENT_FUNDS');
  expect(screen.getByTestId('error-banner-trace')).toHaveTextContent('trace-transfer-fail');
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm nx test customer-portal -t "transfer-form.spec.tsx"`
Expected: FAIL looking for `data-testid="domain-error-banner"`.

**Step 3: Implement code**

- Replace the ad-hoc `<div className="transfer-form__alert transfer-form__alert--error">` in `TransferForm` with `<DomainErrorBanner error={serverError} onRetry={handleRetry} onDismiss={() => setServerError(null)} />`.
- In `DepositWithdrawModal`, replace the inline error paragraph with `<DomainErrorBanner error={serverError} onDismiss={() => setServerError(null)} />`.

**Step 4: Run test to verify it passes**
Run: `pnpm nx test customer-portal -t "transfer-form.spec.tsx"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/customer-portal/src/features/transfers/components/transfer-form.tsx apps/customer-portal/src/features/transfers/components/deposit-withdraw-modal.tsx apps/customer-portal/src/features/transfers/components/transfer-form.spec.tsx apps/customer-portal/src/features/transfers/components/deposit-withdraw-modal.spec.tsx
git commit -m "feat(customer-portal): integrate DomainErrorBanner into TransferForm and DepositWithdrawModal"
```

---

### Task 5: Standardize DomainErrorBanner Integration in Foreign Exchange (FX)

**Files:**

- Modify: `apps/customer-portal/src/features/fx/components/fx-transfer-form.tsx`
- Modify: `apps/customer-portal/src/features/fx/components/fx-quote-dialog.tsx`
- Modify: `apps/customer-portal/src/features/fx/fx-page.tsx`
- Test: `apps/customer-portal/src/features/fx/components/fx-transfer-form.spec.tsx`
- Test: `apps/customer-portal/src/features/fx/components/fx-quote-dialog.spec.tsx`
- Test: `apps/customer-portal/src/features/fx/fx-page.spec.tsx`

**Step 1: Write the failing test**
Update tests in `fx-transfer-form.spec.tsx` and `fx-quote-dialog.spec.tsx` to assert that server errors during quote request or execution render using `data-testid="domain-error-banner"`.

**Step 2: Run test to verify it fails**
Run: `pnpm nx test customer-portal -t "fx-transfer-form.spec.tsx"`
Expected: FAIL looking for `domain-error-banner`.

**Step 3: Implement code**

- In `fx-transfer-form.tsx`, replace raw error strings with `<DomainErrorBanner error={error} onDismiss={clearError} />`.
- In `fx-quote-dialog.tsx`, display `<DomainErrorBanner error={quoteError} />` when quote creation fails (e.g. unsupported currency pair 422 or rate limited 429).
- In `fx-page.tsx`, show `<DomainErrorBanner error={ratesError} onRetry={refetchRates} />` if rate fetching fails.

**Step 4: Run test to verify it passes**
Run: `pnpm nx test customer-portal -t "fx-transfer-form.spec.tsx"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/customer-portal/src/features/fx/
git commit -m "feat(customer-portal): integrate DomainErrorBanner across FX rates, quote dialog, and transfers"
```

---

### Task 6: Full Verification & Monorepo Audit

**Files:**

- Full monorepo verification

**Step 1: Run comprehensive tests**

```bash
pnpm nx run-many -t test --all
```

Expected: 100% passing across all 6 projects.

**Step 2: Run typecheck, lint, and build**

```bash
pnpm nx run-many -t typecheck lint build
```

Expected: 0 errors, 0 warnings.

**Step 3: Verify code formatting**

```bash
pnpm nx format:check
```

Expected: Clean formatting.

**Step 4: Final commit and push**

```bash
git add .
git commit -m "chore(customer-portal): complete S3-T6 error boundary and domain error banner integration"
git push origin develop
```
