# Sprint 4 (S4-T4): Authorization Hold Management View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the back-office Authorization Hold Management workspace in Angular 19 (`/holds`), empowering operators and admins to place administrative holds with client idempotency (FR-OPS-ACC-03, BR-F03), inspect active/expired holds per account, execute partial/full captures into settled transactions, perform manual early releases, and trigger expired hold sweeps.

**Architecture:**

- **State Management Service (`HoldAdminService`):** Signals-based Angular 19 service managing hold collections, account queries, active filters, loading/error signals, computed aggregates (active holds count, total held amount), and mutations connecting to `@ble-frontend/api-client` (`listAccountHolds`, `createHold`, `releaseHold`, `captureHold`, `expireHolds`).
- **Modal Dialog Components:**
  - `PlaceHoldModalComponent`: Account picker, amount + currency, reason, expiration presets (+1h, +24h, +7d), and UUID v4 idempotency key.
  - `CaptureHoldModalComponent`: Captures held funds into settled debit transaction with amount validation and reference.
  - `ReleaseHoldModalComponent`: Early manual hold release with operator release reason.
- **High-Density Workspace (`HoldManagementComponent`):** Standalone Angular 19 component at `/holds`, supporting `?accountId=` query navigation, summary KPI badges, multi-state filtering (PLACED, CAPTURED, RELEASED, EXPIRED), active-only toggle, quick sweep button, and table row action menus.

**Tech Stack:** Angular 19 (Standalone, Signals, FormsModule, CommonModule, Router), Vitest, TypeScript 5.7, `@ble-frontend/api-client`, `@ble-frontend/domain-types`.

---

## Task Breakdown

### Task 1: Build `HoldAdminService` with Reactive Signals and Mutations

**Files:**

- Create: `apps/admin-console/src/features/holds/services/hold-admin.service.ts`
- Create: `apps/admin-console/src/features/holds/services/hold-admin.service.spec.ts`
- Create: `apps/admin-console/src/features/holds/services/index.ts`

**Steps:**

1. Write failing tests in `hold-admin.service.spec.ts`:
   - `loadHolds(accountId, activeOnly)`: fetches holds via `listAccountHolds`, updates `holds` signal, handles error.
   - `placeHold(accountId, request)`: sends `createHold` with `Idempotency-Key` header, prepends to `holds` signal.
   - `releaseHold(holdId, reason)`: sends `releaseHold` with `Idempotency-Key` header, updates item status to `RELEASED`.
   - `captureHold(holdId, request)`: sends `captureHold` with `Idempotency-Key` header, updates item status to `CAPTURED`.
   - `sweepExpiredHolds()`: calls `expireHolds` and refreshes current holds.
   - Computeds: `activeHoldsCount`, `totalHeldAmount`, `filteredHolds` by status.
2. Implement `HoldAdminService` using Angular 19 `signal`, `computed`, and `inject(AccountAdminService)` (for account currency/details helper).
3. Run `pnpm vitest run apps/admin-console/src/features/holds/services/hold-admin.service.spec.ts`.
4. Commit:
   ```bash
   feat(admin-console): implement HoldAdminService with signals and hold lifecycle mutations (S4-T4)
   ```

---

### Task 2: Build Hold Action Modals (`PlaceHold`, `CaptureHold`, `ReleaseHold`)

**Files:**

- Create: `apps/admin-console/src/features/holds/components/place-hold-modal.component.ts`
- Create: `apps/admin-console/src/features/holds/components/place-hold-modal.component.spec.ts`
- Create: `apps/admin-console/src/features/holds/components/capture-hold-modal.component.ts`
- Create: `apps/admin-console/src/features/holds/components/capture-hold-modal.component.spec.ts`
- Create: `apps/admin-console/src/features/holds/components/release-hold-modal.component.ts`
- Create: `apps/admin-console/src/features/holds/components/release-hold-modal.component.spec.ts`
- Create: `apps/admin-console/src/features/holds/components/index.ts`

**Steps:**

1. Write failing tests for each modal:
   - `PlaceHoldModalComponent`: validates account ID, amount > 0, currency, reason, expiration datetime; auto-generates idempotency key; disables submit when invalid.
   - `CaptureHoldModalComponent`: displays hold amount, validates capture amount <= held amount, description, reference; emits success.
   - `ReleaseHoldModalComponent`: displays hold summary, requires or accepts release reason, emits success.
2. Implement components using Angular 19 standalone structure, dark fintech token styles, escape key handling, and backdrop dismissal.
3. Run tests for all three components:
   `pnpm vitest run apps/admin-console/src/features/holds/components/`
4. Commit:
   ```bash
   feat(admin-console): build PlaceHold, CaptureHold, and ReleaseHold modal dialogs (S4-T4)
   ```

---

### Task 3: Build High-Density `HoldManagementComponent`

**Files:**

- Modify: `apps/admin-console/src/features/holds/hold-management.component.ts`
- Create: `apps/admin-console/src/features/holds/hold-management.component.spec.ts`
- Create: `apps/admin-console/src/features/holds/index.ts`

**Steps:**

1. Write failing tests in `hold-management.component.spec.ts`:
   - Renders stats summary cards: Active Holds, Total Volume, Expired Holds.
   - Account search input / selector updates `selectedAccountId` and triggers `loadHolds`.
   - Filters by status chips (ALL, PLACED, CAPTURED, RELEASED, EXPIRED).
   - "Place Hold" button opens `PlaceHoldModalComponent`.
   - "Capture" action opens `CaptureHoldModalComponent` for active holds.
   - "Release" action opens `ReleaseHoldModalComponent` for active holds.
   - "Sweep Expired" button calls `sweepExpiredHolds()` and shows notification.
   - Reads `accountId` query param from `ActivatedRoute` and pre-loads holds.
2. Implement high-density `HoldManagementComponent` in `hold-management.component.ts`:
   - Dark fintech aesthetics matching `AccountTableComponent`.
   - Status badges: `PLACED` (cyan/blue), `CAPTURED` (emerald), `RELEASED` (slate/muted), `EXPIRED` (rose/amber).
   - Responsive actions table with clipboard copy for Hold IDs and References.
   - Integration of all three modal dialogs and notification toasts.
3. Run tests:
   `pnpm vitest run apps/admin-console/src/features/holds/`
4. Commit:
   ```bash
   feat(admin-console): build HoldManagementComponent high-density workspace (S4-T4)
   ```

---

### Task 4: Link Account Table to Holds Workspace (`?accountId=...`)

**Files:**

- Modify: `apps/admin-console/src/features/accounts/account-table.component.ts`
- Modify: `apps/admin-console/src/features/accounts/account-table.component.spec.ts`

**Steps:**

1. Write test in `account-table.component.spec.ts`:
   - "View Holds" action button navigates to `/holds?accountId={id}`.
2. Implement navigation trigger in `AccountTableComponent`.
3. Verify all account-table tests pass.
4. Commit:
   ```bash
   feat(admin-console): add view holds navigation link in AccountTableComponent (S4-T4)
   ```

---

### Task 5: Monorepo Quality Gates, Formatting & Verification

**Steps:**

1. Run all admin-console tests:
   `pnpm vitest run --config apps/admin-console/vitest.config.ts`
2. Run customer-portal tests:
   `pnpm vitest run --config apps/customer-portal/vitest.config.ts`
3. Run monorepo typecheck, lint, and build:
   `pnpm nx run-many -t typecheck lint build`
4. Run Prettier format check:
   `pnpm nx format:write && pnpm nx format:check`
5. Commit and push:
   ```bash
   git push origin develop
   ```
