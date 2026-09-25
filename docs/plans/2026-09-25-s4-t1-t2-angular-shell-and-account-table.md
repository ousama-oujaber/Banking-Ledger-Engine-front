# Sprint 4 (S4-T1 & S4-T2): Angular 19 Shell & High-Density Account Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Angular 19 Back-Office Standalone Shell with high-density navigation, operator profile, and role-based route guards (S4-T1), and deliver the High-Density Account Search & Management Table featuring multi-column filtering, sorting, and pagination (S4-T2).

**Architecture:**

- Angular 19 Standalone Components with Zoneless change detection (`provideExperimentalZonelessChangeDetection`).
- Signals-based state management (`signal`, `computed`, `effect`) for fine-grained reactivity and zero-overhead table filtering/pagination.
- Headless Design System integration with `@ble-frontend/tokens` custom CSS properties, tailored for a high-density operator workspace.
- Functional route guards (`roleGuard`, `authGuard`) enforcing RBAC (`OPERATOR`, `AUDITOR`, `ADMIN`, `SYSTEM`).
- REST integration via `@ble-frontend/api-client` adhering to banking invariants (BR-F01 Decimal Precision, BR-F02 Authoritative Derived Balance).

**Tech Stack:** Angular 19 (Standalone, Signals, Router, CommonModule), Vitest, JSDOM, TypeScript 5.7, `@ble-frontend/tokens`, `@ble-frontend/auth`, `@ble-frontend/api-client`.

---

## Task 1: Back-Office Design System Styles & Tokens Integration (S4-T1 Foundation)

**Files:**

- Create: `apps/admin-console/src/styles.css`
- Modify: `angular.json:20`

### Step 1: Write the Back-Office Global Stylesheet

Create `apps/admin-console/src/styles.css` incorporating the `@ble-frontend/tokens/variables.css` slots and defining high-density operator console variables:

- Dark slate/navy console background (`--ble-color-background: #0f172a;`, `--ble-color-surface: #1e293b;`).
- High-contrast text slots (`#f8fafc`, `#94a3b8`).
- Domain status tokens (`ACTIVE`: `#22c55e`, `FROZEN`: `#f59e0b`, `CLOSED`: `#ef4444`).
- Monospace font family (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) for account IDs, amounts, and hashes.
- Compact table styling and high-density scrollbars.

### Step 2: Register Global Styles in `angular.json`

Update `angular.json` under `projects.admin-console.architect.build.options.styles` to include `"apps/admin-console/src/styles.css"`.

### Step 3: Run Build & Lint Verification

Run: `pnpm nx build admin-console && pnpm nx lint admin-console`
Expected: Build succeeds, 0 lint errors.

### Step 4: Commit

```bash
git add apps/admin-console/src/styles.css angular.json
git commit -m "feat(admin-console): integrate high-density design tokens and back-office styles"
```

---

## Task 2: Angular 19 Standalone Shell with Navigation Sidebar & Operator Profile (S4-T1)

**Files:**

- Modify: `apps/admin-console/src/features/layout/layout.component.ts`
- Modify: `apps/admin-console/src/features/layout/layout.component.spec.ts`

### Step 1: Write Failing / Expanded Layout Tests

Add test cases in `apps/admin-console/src/features/layout/layout.component.spec.ts`:

- Test that all 6 navigation links are rendered (`/accounts`, `/audit`, `/holds`, `/recon`, `/dlq`, `/rules`).
- Test operator profile rendering: username, name, role badges (`OPERATOR`, `AUDITOR`), and avatar initials (`SC` for Sarah Connor).
- Test fallback initials and role formatting when user has no full name.
- Test active session status indicator (`Active (Zoneless)`).
- Test sidebar collapse toggle state signal.
- Test logout button triggers `AuthService.clear()` and navigation to `/login`.

### Step 2: Run Tests to Verify Failures

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/layout/layout.component.spec.ts`
Expected: FAIL on new profile & sidebar expectations.

### Step 3: Implement Standalone Shell in `layout.component.ts`

- Implement Signals-based layout:
  - `user = signal<AuthUser | null>(AuthService.getUser());`
  - `collapsed = signal<boolean>(false);`
  - `toggleSidebar(): void`
  - `operatorInitials = computed<string>(...)`
  - `userRolesList = computed<string[]>(...)`
- HTML structure:
  - Sidebar:
    - Brand logo & title ("BLE Back-Office").
    - Operator Profile Card with avatar initials, display name, role chips, and session badge.
    - Navigation menu items with SVG icons and `routerLinkActive="active"`.
    - Logout action button with clean session wipe.
  - Main area:
    - Top Bar / Header: active route title, environment pill (`STAGING`), live UTC time ticker, sidebar toggle.
    - Router outlet container.
- Complete scoped CSS using `:host` and semantic CSS variables.

### Step 4: Run Tests to Verify Pass

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/layout/layout.component.spec.ts`
Expected: PASS all tests.

### Step 5: Commit

```bash
git add apps/admin-console/src/features/layout/
git commit -m "feat(admin-console): build Angular 19 standalone shell with operator profile and sidebar navigation (S4-T1)"
```

---

## Task 3: Account Management Signals State Store & Admin Service (S4-T2 State Layer)

**Files:**

- Create: `apps/admin-console/src/features/accounts/services/account-admin.service.ts`
- Create: `apps/admin-console/src/features/accounts/services/account-admin.service.spec.ts`

### Step 1: Write Unit Tests for `AccountAdminService`

Write tests in `apps/admin-console/src/features/accounts/services/account-admin.service.spec.ts`:

- Test initial state: empty accounts, `loading = false`, `error = null`, default page = 1, default pageSize = 10.
- Test `loadAccounts()` populates `accounts` signal via API or falls back gracefully on network error.
- Test `searchQuery` computed filtering (matches partial account ID, customer ID).
- Test `statusFilter` computed filtering (`ACTIVE`, `FROZEN`, `CLOSED`).
- Test `typeFilter` computed filtering (`CHECKING`, `SAVINGS`, `SUSPENSE`, etc.).
- Test `currencyFilter` computed filtering (`EUR`, `USD`, `GBP`).
- Test `sortBy` and `sortDirection` sorting by ID, balance, status, currency.
- Test pagination slicing: `paginatedAccounts`, `totalPages`, `totalCount`.
- Test `setPage()`, `setPageSize()`, and `resetFilters()`.

### Step 2: Run Test to Verify Failure

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/accounts/services/account-admin.service.spec.ts`
Expected: FAIL (service not found).

### Step 3: Implement `AccountAdminService`

- In `apps/admin-console/src/features/accounts/services/account-admin.service.ts`:
  - Writable Signals:
    - `accounts = signal<AccountResponse[]>([])`
    - `loading = signal<boolean>(false)`
    - `error = signal<string | null>(null)`
    - `searchQuery = signal<string>('')`
    - `statusFilter = signal<string>('ALL')`
    - `typeFilter = signal<string>('ALL')`
    - `currencyFilter = signal<string>('ALL')`
    - `sortBy = signal<string>('id')`
    - `sortDirection = signal<'asc' | 'desc'>('asc')`
    - `currentPage = signal<number>(1)`
    - `pageSize = signal<number>(10)`
  - Computed Signals:
    - `filteredAccounts`: filters accounts by search string and dropdown criteria.
    - `sortedAccounts`: sorts filtered list by active column and direction.
    - `paginatedAccounts`: slices sorted list for `(currentPage - 1) * pageSize` to `currentPage * pageSize`.
    - `totalPages`: `Math.max(1, Math.ceil(filteredAccounts().length / pageSize()))`.
    - `totalCount`: `filteredAccounts().length`.
    - `hasActiveFilters`: computed boolean indicating if any filter is non-default.
  - Actions:
    - `loadAccounts(): Promise<void>`
    - `setSearch(q: string): void`
    - `setStatusFilter(s: string): void`
    - `setTypeFilter(t: string): void`
    - `setCurrencyFilter(c: string): void`
    - `toggleSort(column: string): void`
    - `setPage(page: number): void`
    - `setPageSize(size: number): void`
    - `resetFilters(): void`

### Step 4: Run Tests to Verify Pass

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/accounts/services/account-admin.service.spec.ts`
Expected: PASS all tests.

### Step 5: Commit

```bash
git add apps/admin-console/src/features/accounts/services/
git commit -m "feat(admin-console): implement signals-based AccountAdminService with filtering, sorting, and pagination"
```

---

## Task 4: High-Density Account Search & Management Table Component (S4-T2 UI Layer)

**Files:**

- Modify: `apps/admin-console/src/features/accounts/account-table.component.ts`
- Create: `apps/admin-console/src/features/accounts/account-table.component.spec.ts`

### Step 1: Write Unit & Integration Tests for `AccountTableComponent`

Write tests in `apps/admin-console/src/features/accounts/account-table.component.spec.ts`:

- Test component renders search input (`data-testid="account-search-input"`), filter dropdowns (`status`, `type`, `currency`), and refresh button.
- Test table headers are sortable and toggle sort indicators.
- Test account rows render account ID in monospace, customer ID, type badge, currency, status badge (`data-testid="status-badge-${id}"`), and formatted derived balance.
- Test searching by account ID updates displayed rows.
- Test status filter limits rows to selected status.
- Test pagination controls: previous/next disabled at boundaries, page size selector updates row count, page indicator text.
- Test loading skeleton state when `loading() === true`.
- Test empty state message when search returns 0 results.
- Test error alert and retry button when `error() !== null`.
- Test lifecycle action buttons (Freeze, Unfreeze, Close) render correctly per account status.

### Step 2: Run Tests to Verify Failure

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/accounts/account-table.component.spec.ts`
Expected: FAIL on missing test IDs and table features.

### Step 3: Implement `AccountTableComponent`

- In `apps/admin-console/src/features/accounts/account-table.component.ts`:
  - Standalone Component importing `CommonModule`, `FormsModule`.
  - Injected `AccountAdminService`.
  - High-density operator UI:
    - **Header & Stats Bar:** Total accounts count, active filters summary, quick refresh button with spinner.
    - **Filter Toolbar:**
      - Search input with clear button (`data-testid="account-search-input"`).
      - Account Type filter (`ALL`, `CHECKING`, `SAVINGS`, `SUSPENSE`, `SETTLEMENT`, `FEE`).
      - Status filter (`ALL`, `ACTIVE`, `FROZEN`, `CLOSED`).
      - Currency filter (`ALL`, `EUR`, `USD`, `GBP`, `JPY`, `CHF`).
      - "Reset Filters" button enabled when `hasActiveFilters()`.
    - **Data Table:**
      - High-density layout (`th`, `td` compact padding, zebra striping, hover highlight).
      - Sortable headers with indicators (`▲` / `▼`).
      - Monospace Account ID with click-to-copy button and tooltip.
      - Status badges with accessible colors (`status-badge active`, `status-badge frozen`, `status-badge closed`).
      - Derived balance formatted with currency symbol and precision (never native floats).
      - Actions cell:
        - `Freeze` button (shown if `status === 'ACTIVE'`).
        - `Unfreeze` button (shown if `status === 'FROZEN'`).
        - `Close` button (disabled if `derivedBalance !== '0.00'` per BR-F05).
    - **Pagination Bar:**
      - "Showing X to Y of Z accounts".
      - Page size select (`10`, `25`, `50`).
      - First, Prev, Page numbers, Next, Last buttons.
    - **Empty State & Error States:**
      - Clear visual alert and retry trigger.
- Scoped component CSS for compact operator density.

### Step 4: Run Tests to Verify Pass

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts apps/admin-console/src/features/accounts/account-table.component.spec.ts`
Expected: PASS all tests.

### Step 5: Commit

```bash
git add apps/admin-console/src/features/accounts/
git commit -m "feat(admin-console): deliver high-density AccountTableComponent with multi-column filtering and pagination (S4-T2)"
```

---

## Task 5: Full Monorepo Quality Gates, Formatting & Review Verification

**Files:**

- Modify: Any files with formatting or lint issues

### Step 1: Run All Admin Console Tests

Run: `pnpm vitest run --config apps/admin-console/vitest.config.ts`
Expected: All test files passing (guards, layout, login, access-denied, account-admin.service, account-table).

### Step 2: Run Full Monorepo Test Suites

Run: `pnpm vitest run --config apps/customer-portal/vitest.config.ts`
Expected: All 45 customer portal test files passing.

### Step 3: Run Full Monorepo Typecheck, Lint, and Build

Run: `pnpm nx run-many -t typecheck lint build`
Expected: 14/14 targets succeed with exit code 0.

### Step 4: Run Prettier Format Check

Run: `pnpm nx format:write && pnpm nx format:check`
Expected: Code formatted, format check passes.

### Step 5: Commit Any Final Hardening / Formatting

```bash
git commit -am "chore(admin-console): format code and finalize S4-T1/S4-T2 deliverables"
```

---

## Plan Document Complete & Execution Choice

This plan delivers **S4-T1** and **S4-T2** in complete accordance with the specifications in `project-doc/01-Frontend_Specifications_and_Sprint_Plan.md`.
