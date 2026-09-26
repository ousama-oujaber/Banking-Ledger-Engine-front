# Sprint 4 (S4-T3): Account Lifecycle Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement back-office account lifecycle operations in Angular 19: Administrative Freeze with mandatory reason (FR-OPS-ACC-01), Unfreeze to restore operations, and Account Close with zero-balance invariant enforcement (FR-OPS-ACC-02, BR-F05) and explicit confirmation modals.

**Architecture:**

- **Service Mutation Layer (`AccountAdminService`):** Connects to `@ble-frontend/api-client` endpoints (`POST /api/v1/accounts/{id}/freeze`, `POST /api/v1/accounts/{id}/unfreeze`, `POST /api/v1/accounts/{id}/close`), updates the reactive `accounts` signal on success, and manages mutation loading/error state.
- **Standalone Modal Component (`AccountLifecycleModalComponent`):** Standalone Angular 19 component with backdrop, accessible modal dialog, reactive signal form state, validation, and domain error display.
- **Table Integration (`AccountTableComponent`):** Wires "Freeze", "Unfreeze", and "Close" action buttons to open the modal with the target account and mode, updating the table instantaneously upon completion.

**Tech Stack:** Angular 19 (Standalone, Signals, FormsModule, CommonModule), Vitest, TypeScript 5.7, `@ble-frontend/api-client`.

---

## Task Breakdown

### Task 1: Extend `AccountAdminService` with Lifecycle Mutations

**Files:**

- Modify: `apps/admin-console/src/features/accounts/services/account-admin.service.ts`
- Modify: `apps/admin-console/src/features/accounts/services/account-admin.service.spec.ts`

**Steps:**

1. Add failing tests in `account-admin.service.spec.ts` for:
   - `freezeAccount(id, reason)`: verifies payload `{ reason }`, calls endpoint, updates account status to `FROZEN`.
   - `unfreezeAccount(id, reason)`: calls endpoint, updates account status to `ACTIVE`.
   - `closeAccount(id)`: calls endpoint, verifies zero-balance check, updates account status to `CLOSED`.
   - Error handling: propagates server errors and sets service `error` signal.
2. Implement `freezeAccount`, `unfreezeAccount`, and `closeAccount` in `AccountAdminService`.
3. Verify all service tests pass.
4. Commit.

---

### Task 2: Build `AccountLifecycleModalComponent`

**Files:**

- Create: `apps/admin-console/src/features/accounts/components/account-lifecycle-modal.component.ts`
- Create: `apps/admin-console/src/features/accounts/components/account-lifecycle-modal.component.spec.ts`
- Modify: `apps/admin-console/src/features/accounts/index.ts`

**Steps:**

1. Write failing tests for `AccountLifecycleModalComponent`:
   - Modal renders account details (ID, owner, type, currency, balance).
   - Mode `FREEZE`: requires non-empty `reason` string (`data-testid="freeze-reason-input"`), submit button disabled when reason is empty.
   - Mode `UNFREEZE`: displays confirmation, optional reason, submit button restores active status.
   - Mode `CLOSE`: displays irreversible warning badge, requires confirmation checkbox or check, blocks closure if balance != 0.00 with guidance to sweep funds first (BR-F05).
   - Close modal event on Cancel button or Escape key.
   - Loading indicator on submit button.
   - Server error banner inside modal when operation fails.
2. Implement `AccountLifecycleModalComponent` using Angular 19 signals (`input`, `output`, `signal`).
3. Verify all modal unit tests pass.
4. Commit.

---

### Task 3: Integrate Lifecycle Modal into `AccountTableComponent`

**Files:**

- Modify: `apps/admin-console/src/features/accounts/account-table.component.ts`
- Modify: `apps/admin-console/src/features/accounts/account-table.component.spec.ts`

**Steps:**

1. Write tests in `account-table.component.spec.ts`:
   - Clicking "Freeze" button sets active modal account and mode to `FREEZE`.
   - Clicking "Unfreeze" button sets active modal account and mode to `UNFREEZE`.
   - Clicking "Close" button sets active modal account and mode to `CLOSE`.
   - Handling modal success callback refreshes or updates local row state.
2. Import and render `<ble-account-lifecycle-modal>` in `account-table.component.ts`.
3. Implement `freeze(account)`, `unfreeze(account)`, `close(account)`, and `onModalSuccess()` handlers.
4. Verify all table tests pass.
5. Commit.

---

### Task 4: Full Quality Gates, Formatting & Review Verification

**Steps:**

1. Run all admin console tests (`pnpm vitest run --config apps/admin-console/vitest.config.ts`).
2. Run customer portal tests (`pnpm vitest run --config apps/customer-portal/vitest.config.ts`).
3. Run monorepo typecheck, lint, and build (`pnpm nx run-many -t typecheck lint build`).
4. Run Prettier format check (`pnpm nx format:write && pnpm nx format:check`).
5. Commit and push to `origin/develop`.
