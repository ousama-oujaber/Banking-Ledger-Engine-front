# Sprint 5 (S5-T1): Fee & Interest Rule Matrix Management Forms with Dynamic Tier Calculation Previews

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the back-office Fee and Interest Rule Matrix management workspace in Angular 19 (`/rules`), enabling bank administrators and operators to configure multi-tier transaction fee rules (`FIXED`, `PERCENTAGE`, `TIERED`) and interest accrual rules, preview dynamic fee tier calculations and interest forecasts in real-time, and trigger administrative interest accrual/posting operations (FR-OPS-RULES-01, FR-OPS-RULES-02).

**Architecture:**

- **State Management Layer (`RuleAdminService`):** Angular 19 Signals-based service orchestrating both Fee Rules and Interest Rules collections, selected rule version inspections, loading/error states, simulation responses, and mutation endpoints from `@ble-frontend/api-client` (`listFeeRules`, `createFeeRule`, `getFeeRuleByCode`, `getFeeRuleByCodeAndVersion`, `previewFee`, `listRules`, `createRule`, `getRuleByCode`, `previewInterest`, `accrueInterest`, `postInterest`, `listAccruals`).
- **Interactive Component Tree (`apps/admin-console/src/features/rules/`):**
  - `RulesMatrixComponent`: Main high-density tabbed workspace containing "Fee Rules", "Interest Rules", and "Simulation Sandbox" tabs.
  - `FeeRuleFormComponent`: Standalone form for creating/editing fee rules with dynamic array of tiers (`FeeTierDto`: `minAmount`, `maxAmount`, `feeValue`, `isPercentage`), boundaries (`minFee`, `maxFee`), tax rate, and income account assignment.
  - `InterestRuleFormComponent`: Standalone form for configuring interest products, accrual bases (`ACT_365`, `ACT_360`, `THIRTY_360`, `ACT_ACT`), balance bases (`LEDGER_BALANCE`, `AVAILABLE_BALANCE`), annual rates, and date bounds.
  - `FeeCalculationSimulatorComponent`: Live interactive calculator simulating fee deduction, tier breakdown, and tax impact for arbitrary transaction amounts via `POST /api/v1/fee-rules/preview`.
  - `InterestPreviewModalComponent`: Simulates point-in-time and projected interest accrual runs across historical date ranges via `POST /api/v1/interest/preview`.
- **Design System & Aesthetics:** High-density dark fintech styling matching existing S4 back-office standards (`AccountTableComponent`, `AccountLifecycleModalComponent`), rich badges for calculation types and currency codes, monospace numeric values, and responsive drawer/modal layouts.

**Tech Stack:** Angular 19 (Standalone, Signals, ReactiveFormsModule / FormsModule, CommonModule), Vitest, TypeScript 5.7, `@ble-frontend/api-client`, `@ble-frontend/domain-types`.

---

## Task Breakdown

### Task 1: Build `RuleAdminService` with Signals, Dual Rule Collections & Simulators

**Files:**

- Create: `apps/admin-console/src/features/rules/services/rule-admin.service.ts`
- Create: `apps/admin-console/src/features/rules/services/rule-admin.service.spec.ts`
- Create: `apps/admin-console/src/features/rules/services/index.ts`

**Steps:**

1. Write failing tests in `rule-admin.service.spec.ts`:
   - `loadFeeRules()`: calls `listFeeRules`, updates `feeRules` signal, sets error on failure.
   - `createFeeRule(request)`: calls `createFeeRule`, prepends new rule to signal.
   - `simulateFee(request)`: calls `previewFee`, returns calculated fee and tier details.
   - `loadInterestRules()`: calls `listRules`, updates `interestRules` signal.
   - `createInterestRule(request)`: calls `createRule`, prepends new interest rule to signal.
   - `simulateInterest(request)`: calls `previewInterest`, returns preview estimate and daily accruals array.
   - `triggerAccrual()` & `triggerPosting()`: calls `accrueInterest` and `postInterest`.
   - Computeds: `activeFeeRulesCount`, `activeInterestRulesCount`, `feeRulesByCurrency`, `filteredFeeRules`.
2. Implement `RuleAdminService` using Angular 19 `signal`, `computed`, and `@ble-frontend/api-client`.
3. Run `pnpm vitest run apps/admin-console/src/features/rules/services/rule-admin.service.spec.ts`.
4. Commit:
   ```bash
   feat(admin-console): implement RuleAdminService with fee and interest rule mutations (S5-T1)
   ```

---

### Task 2: Build `FeeRuleFormComponent` with Dynamic Tier Builder

**Files:**

- Create: `apps/admin-console/src/features/rules/components/fee-rule-form.component.ts`
- Create: `apps/admin-console/src/features/rules/components/fee-rule-form.component.spec.ts`
- Create: `apps/admin-console/src/features/rules/components/fee-tier-builder.component.ts`
- Create: `apps/admin-console/src/features/rules/components/fee-tier-builder.component.spec.ts`

**Steps:**

1. Write failing tests:
   - `FeeTierBuilderComponent`: allows adding/removing tiers, validates non-overlapping intervals (`minAmount` < `maxAmount`), toggles fixed fee vs percentage rate, formats values.
   - `FeeRuleFormComponent`: validates code uniqueness format (alphanumeric uppercase), transaction type selection, calculation type toggle (`FIXED` -> shows `fixedAmount`; `PERCENTAGE` -> shows `percentageRate`; `TIERED` -> renders tier builder), validates boundary constraints (`minFee <= maxFee`), validates required `feeIncomeAccountId`.
2. Implement `FeeTierBuilderComponent` and `FeeRuleFormComponent` using Angular 19 reactive forms/signals with accessible dark theme inputs.
3. Run vitest on component specs:
   `pnpm vitest run apps/admin-console/src/features/rules/components/`
4. Commit:
   ```bash
   feat(admin-console): build FeeRuleFormComponent and FeeTierBuilderComponent (S5-T1)
   ```

---

### Task 3: Build Live Calculation Simulators (`FeeCalculationSimulatorComponent` & `InterestPreviewModalComponent`)

**Files:**

- Create: `apps/admin-console/src/features/rules/components/fee-calculation-simulator.component.ts`
- Create: `apps/admin-console/src/features/rules/components/fee-calculation-simulator.component.spec.ts`
- Create: `apps/admin-console/src/features/rules/components/interest-preview-modal.component.ts`
- Create: `apps/admin-console/src/features/rules/components/interest-preview-modal.component.spec.ts`

**Steps:**

1. Write failing tests:
   - `FeeCalculationSimulatorComponent`: inputs transaction type, amount, currency, and optional fee rule code; runs simulation; renders breakdown pill showing calculated gross fee, tax deduction, net fee, and effective percentage.
   - `InterestPreviewModalComponent`: inputs account ID, fromDate, toDate; fetches forecast; renders total estimated interest and expandable daily accruals list with status indicators (`ACCRUED`, `POSTED`).
2. Implement both simulation components with real-time reactive debounce or trigger buttons, error handling, and currency formatting helpers from `@ble-frontend/domain-types`.
3. Run vitest on simulator specs:
   `pnpm vitest run apps/admin-console/src/features/rules/components/`
4. Commit:
   ```bash
   feat(admin-console): build live fee calculation simulator and interest forecast preview (S5-T1)
   ```

---

### Task 4: Build `InterestRuleFormComponent` & Accrual Operations Dialog

**Files:**

- Create: `apps/admin-console/src/features/rules/components/interest-rule-form.component.ts`
- Create: `apps/admin-console/src/features/rules/components/interest-rule-form.component.spec.ts`
- Create: `apps/admin-console/src/features/rules/components/interest-ops-modal.component.ts`
- Create: `apps/admin-console/src/features/rules/components/interest-ops-modal.component.spec.ts`

**Steps:**

1. Write failing tests:
   - `InterestRuleFormComponent`: validates code, product code, interest type (`CREDIT` vs `DEBIT`), annual rate (0% - 100%), accrual basis dropdown, balance basis, minimum balance thresholds, and date validity periods.
   - `InterestOpsModalComponent`: allows operators to trigger daily accrual sweep (`POST /api/v1/interest/accrue`) or end-of-period interest posting (`POST /api/v1/interest/post`) with confirmation prompt and execution status feedback.
2. Implement components using Angular 19 signals and standalone architecture.
3. Run vitest on components:
   `pnpm vitest run apps/admin-console/src/features/rules/components/`
4. Commit:
   ```bash
   feat(admin-console): build InterestRuleFormComponent and interest ops triggers (S5-T1)
   ```

---

### Task 5: Assemble High-Density `RulesMatrixComponent` Workspace

**Files:**

- Modify: `apps/admin-console/src/features/rules/rules-matrix.component.ts`
- Create: `apps/admin-console/src/features/rules/rules-matrix.component.spec.ts`
- Create: `apps/admin-console/src/features/rules/index.ts`

**Steps:**

1. Write failing tests in `rules-matrix.component.spec.ts`:
   - Renders tabbed navigation ("Fee Rules", "Interest Rules", "Simulation Sandbox").
   - Fee Rules tab renders dense data table with rule code, name, transaction type, currency, calculation type pill, version, and action to inspect/version audit.
   - Interest Rules tab renders rules table with product code, interest type, rate, accrual basis, and "Trigger Accrual / Post" actions.
   - "New Fee Rule" button opens `FeeRuleFormComponent` drawer/modal.
   - "New Interest Rule" button opens `InterestRuleFormComponent` drawer/modal.
   - Simulation tab integrates `FeeCalculationSimulatorComponent` with pre-filled rule selector.
2. Implement `RulesMatrixComponent` in `rules-matrix.component.ts` with complete styles and responsive dark fintech UI.
3. Run vitest on full rules suite:
   `pnpm vitest run apps/admin-console/src/features/rules/`
4. Commit:
   ```bash
   feat(admin-console): assemble high-density RulesMatrixComponent workspace (S5-T1)
   ```

---

### Task 6: Full Quality Gates, Formatting & Verification

**Steps:**

1. Run all admin-console tests:
   `pnpm vitest run --config apps/admin-console/vitest.config.ts`
2. Run customer-portal tests:
   `pnpm vitest run --config apps/customer-portal/vitest.config.ts`
3. Run monorepo typecheck, lint, and build:
   `pnpm nx run-many -t typecheck lint build`
4. Run formatting checks:
   `pnpm nx format:write && pnpm nx format:check`
5. Commit and push:
   ```bash
   git push origin develop
   ```
