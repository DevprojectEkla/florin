# Task Decomposition: Balance Calculation Fix

**Epic:** Fix Balance Discrepancy (€2,614.49 → €229.90)  
**Total Estimated Time:** 2-4 hours (Quick Fix) + 2 days (Full Solution)

---

## PR Sequence

### **PR-1: Diagnostic Tool & Database Inspection** ✅ READY
**Status:** Ready to Execute  
**Estimated Time:** 30 minutes  
**Branch:** `fix/balance-diagnostic`

**Description:**
Add diagnostic tooling to inspect database state and confirm root cause hypothesis.

**Files Changed:**
- ✅ `analyze-ca-file.mjs` (created)
- ✅ `diagnostic-balance.md` (created)
- ⏳ `src/db/diagnostics.ts` (new)
- ⏳ `scripts/check-balance.mjs` (new)

**Acceptance Criteria:**
- [ ] Can execute SQL queries against florin.db
- [ ] Outputs current fiscal_years.opening_balance
- [ ] Shows transaction count and sum by fiscal year
- [ ] Identifies duplicate transactions
- [ ] Confirms discrepancy matches hypothesis

**Dependencies:** None

---

### **PR-2: Opening Balance Correction (Quick Fix)**
**Status:** Blocked by PR-1  
**Estimated Time:** 1 hour  
**Branch:** `fix/balance-opening-balance`

**Description:**
Calculate and update correct opening_balance for fiscal year 2025-2026 based on CA export data and ODS monthly summaries.

**Files Changed:**
- `src/db/migrations.ts` (add migration #003)
- `scripts/calculate-opening-balance.mjs` (new)
- `src/db/balance.ts` (add validation)

**Implementation:**

```typescript
// migrations.ts - Migration 003
`
UPDATE fiscal_years 
SET opening_balance = ? 
WHERE label = '2025-2026' AND start_year = 2025;
`

// Calculate from CA file + ODS data:
// May 30, 2026 balance: €2,072.71
// Work backwards using ODS monthly summaries:
//   May: unknown (but June starts at 2072.71)
//   Apr: €250 change
//   Mar: €1,210 change
//   Feb: €276.30 change
//   Jan: €1,495.43 change
//   Dec: €872.20 change
//   Nov: -€1,762.02 change
//   Oct: €379.11 change
//   Sept: -€532.76 change
//
// Working backwards from May 30 (€2,072.71):
// Need to determine May 1 balance, then work back through months
```

**Acceptance Criteria:**
- [ ] Opening balance updated to correct value
- [ ] Balance calculation shows €229.90 as of June 26, 2026
- [ ] Balance at May 30, 2026 shows €2,072.71
- [ ] Migration is reversible
- [ ] Validation test passes

**Dependencies:** PR-1 (need to confirm current DB state)

---

### **PR-3: Transaction Import Validation**
**Status:** Blocked by PR-2  
**Estimated Time:** 2 hours  
**Branch:** `feat/import-validation`

**Description:**
Add validation logic to detect balance mismatches during import and warn users.

**Files Changed:**
- `src/db/import.ts` (add validation)
- `src/lib/ca-parser.ts` (expose metadata)
- `src/pages/Import.tsx` (show validation warnings)
- `src/__tests__/import-validation.test.ts` (new)

**Implementation:**

```typescript
// src/db/import.ts
export interface ImportValidationResult {
  isValid: boolean;
  warnings: string[];
  expectedBalance: number | null;
  actualBalance: number | null;
  discrepancy: number | null;
}

export async function validateImport(
  parsed: ParsedImport,
  fiscalYearId: number
): Promise<ImportValidationResult> {
  // 1. Get current balance from DB
  const currentBalance = await computeCurrentBalance();
  
  // 2. Check if parsed.periodFrom matches last imported transaction date
  const lastTx = await getLastTransactionDate(fiscalYearId);
  
  // 3. If there's a gap, warn user
  const warnings: string[] = [];
  if (lastTx && parsed.periodFrom && lastTx < parsed.periodFrom) {
    warnings.push(
      `Gap detected: Last transaction was ${lastTx}, ` +
      `but import starts at ${parsed.periodFrom}`
    );
  }
  
  // 4. If parsed.balanceAtImport exists, compare with expected
  let discrepancy = null;
  if (parsed.balanceAtImport) {
    const netChange = parsed.transactions.reduce((sum, tx) => 
      sum + (tx.credit || 0) - (tx.debit || 0), 0
    );
    const expectedOpeningForThisPeriod = parsed.balanceAtImport - netChange;
    
    // Compare with current DB balance
    if (Math.abs(currentBalance.balance - expectedOpeningForThisPeriod) > 0.01) {
      discrepancy = currentBalance.balance - expectedOpeningForThisPeriod;
      warnings.push(
        `Balance mismatch: Expected ${expectedOpeningForThisPeriod.toFixed(2)}, ` +
        `but DB shows ${currentBalance.balance.toFixed(2)} ` +
        `(difference: ${discrepancy.toFixed(2)})`
      );
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
    expectedBalance: parsed.balanceAtImport,
    actualBalance: currentBalance.balance,
    discrepancy,
  };
}
```

**Acceptance Criteria:**
- [ ] Import warns when balance mismatch detected
- [ ] Import warns when transaction gap detected
- [ ] UI displays validation warnings
- [ ] User can choose to proceed or cancel
- [ ] Tests cover edge cases

**Dependencies:** PR-2

---

### **PR-4: Historical Transaction Import**
**Status:** Blocked by PR-3  
**Estimated Time:** 3 hours  
**Branch:** `feat/historical-import`

**Description:**
Import all missing transactions from Sept 2025 - May 2026 using either:
1. Historical CA exports (if available)
2. ODS monthly summaries (as fallback)

**Files Changed:**
- `src/lib/ods-parser.ts` (new)
- `src/db/import.ts` (add bulk import)
- `scripts/import-historical.mjs` (new)
- `src/__tests__/ods-parser.test.ts` (new)

**Implementation:**

**Option A: Parse ODS file**
```typescript
// src/lib/ods-parser.ts
export interface ODSMonthSummary {
  month: string; // "sept.-25"
  year: number;
  month: number;
  totalDebits: number;
  totalCredits: number;
  net: number;
}

export async function parseODSSituation(
  odsPath: string
): Promise<ODSMonthSummary[]> {
  // Use odf library to parse "Situation" sheet
  // Extract rows 16-27 (monthly summaries)
  // Return structured data
}

// Then create synthetic transactions:
export function createSyntheticTransaction(
  summary: ODSMonthSummary
): ParsedTransaction[] {
  return [
    {
      date: `${summary.year}-${String(summary.month).padStart(2, '0')}-01`,
      label: `Monthly Summary ${summary.month}/${summary.year} - Debits`,
      debit: summary.totalDebits,
      credit: null,
    },
    {
      date: `${summary.year}-${String(summary.month).padStart(2, '0')}-01`,
      label: `Monthly Summary ${summary.month}/${summary.year} - Credits`,
      debit: null,
      credit: summary.totalCredits,
    },
  ];
}
```

**Option B: Request Historical CA Exports**
- Manually download Sept-May CA exports from bank
- Import using existing parseCAFile() logic
- More accurate, preserves transaction detail

**Acceptance Criteria:**
- [ ] All months Sept 2025 - May 2026 have transaction data
- [ ] Transaction count matches expected
- [ ] Balance calculation is accurate
- [ ] No duplicate transactions created

**Dependencies:** PR-3

---

### **PR-5: Reconciliation Report**
**Status:** Blocked by PR-4  
**Estimated Time:** 4 hours  
**Branch:** `feat/reconciliation-report`

**Description:**
Add dashboard showing balance reconciliation with bank statements and highlighting discrepancies.

**Files Changed:**
- `src/pages/Reconciliation.tsx` (new)
- `src/db/reconciliation.ts` (new)
- `src/hooks/useReconciliation.ts` (new)
- `src/locales/*/common.json` (add translations)

**UI Components:**

```
╔══════════════════════════════════════════════════════╗
║           Balance Reconciliation Report             ║
╠══════════════════════════════════════════════════════╣
║  Fiscal Year: 2025-2026                             ║
║  Period: Sept 1, 2025 - June 26, 2026               ║
║                                                      ║
║  Opening Balance (Sept 1, 2025):    €2,413.32       ║
║  + Total Credits:                   €21,787.53       ║
║  - Total Debits:                    €18,645.95       ║
║  ─────────────────────────────────────────────       ║
║  = Calculated Balance:              €229.90   ✓      ║
║                                                      ║
║  Bank Statement (June 26, 2026):    €229.90   ✓      ║
║  Discrepancy:                       €0.00     ✓      ║
║                                                      ║
║  Last Import: CA20260626_215551.xlsx                 ║
║  Transaction Count: 33 (June only)                   ║
║  Import Date: June 26, 2026 11:51 PM                ║
╚══════════════════════════════════════════════════════╝

Recent Imports:
┌─────────────┬──────────────┬──────────┬─────────┬────────────┐
│ Date        │ File         │ Imported │ Skipped │ Balance    │
├─────────────┼──────────────┼──────────┼─────────┼────────────┤
│ 2026-06-26  │ CA202606...  │ 33       │ 0       │ €229.90 ✓  │
│ 2026-05-31  │ CA202605...  │ 45       │ 2       │ €2,072.71 ✓│
│ 2026-04-30  │ CA202604...  │ 38       │ 0       │ €1,890.15  │
└─────────────┴──────────────┴──────────┴─────────┴────────────┘
```

**Acceptance Criteria:**
- [ ] Shows opening balance and calculation breakdown
- [ ] Compares with bank statement balance
- [ ] Highlights discrepancies > €0.50
- [ ] Lists recent imports with validation status
- [ ] Provides drill-down to transaction details

**Dependencies:** PR-4

---

### **PR-6: Automated Balance Tests**
**Status:** Blocked by PR-4  
**Estimated Time:** 2 hours  
**Branch:** `test/balance-validation`

**Description:**
Add comprehensive unit and integration tests for balance calculation and import validation.

**Files Changed:**
- `src/__tests__/balance-calculation.test.ts` (new)
- `src/__tests__/import-reconciliation.test.ts` (new)
- `src/__tests__/fixtures/ca-sample.xlsx` (new)
- `src/__tests__/fixtures/ca-sample-duplicate.xlsx` (new)

**Test Cases:**

```typescript
describe('Balance Calculation', () => {
  it('calculates balance from opening + credits - debits', () => {
    // Test core formula
  });
  
  it('handles fiscal year boundaries correctly', () => {
    // Test transactions on Aug 31 vs Sept 1
  });
  
  it('matches bank statement balance', () => {
    // Integration test with real CA export
  });
});

describe('Import Validation', () => {
  it('detects balance mismatch', () => {
    // Import with wrong opening balance
  });
  
  it('detects transaction gaps', () => {
    // Import with missing date range
  });
  
  it('prevents duplicate imports', () => {
    // Import same file twice
  });
  
  it('handles overlapping imports', () => {
    // Import May-June, then June-July
  });
});
```

**Acceptance Criteria:**
- [ ] 100% code coverage for balance.ts
- [ ] Integration tests with sample CA files
- [ ] Tests pass in CI/CD
- [ ] Performance tests (>1000 transactions)

**Dependencies:** PR-4

---

## Execution Order

```
PR-1 (Diagnostic)
  ↓
PR-2 (Quick Fix) ──┐
  ↓                 │
PR-3 (Validation)  │ ← Can run tests in parallel
  ↓                 │
PR-4 (Historical)  │
  ↓                 ↓
PR-5 (Report)    PR-6 (Tests)
  ↓                 ↓
  └─────── DONE ───┘
```

---

## Rollback Plan

Each PR includes:
1. **Database Migration:** Reversible with DOWN migration
2. **Feature Flag:** Can disable new validation if issues arise
3. **Backup:** Automated DB backup before changes
4. **Verification:** Smoke tests must pass before merge

**Emergency Rollback:**
```bash
# Revert to previous version
git revert <commit-hash>

# Restore database backup
cp florin.db.backup florin.db

# Restart application
npm run tauri dev
```

---

## Definition of Done

**Per PR:**
- [ ] Code review approved (minimum 1 reviewer)
- [ ] All tests passing
- [ ] No linting errors
- [ ] Documentation updated
- [ ] CHANGELOG.md entry added
- [ ] Verified on local development environment

**Overall Epic:**
- [ ] Balance shows €229.90 (matches bank statement)
- [ ] All transactions from Sept 2025 - June 2026 imported
- [ ] Reconciliation report shows 0 discrepancies
- [ ] Automated tests prevent future regressions
- [ ] User documentation updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Production data corruption | Implement read-only diagnostic mode first |
| Breaking existing imports | Feature flag for new validation |
| Performance degradation | Add pagination and query optimization |
| User confusion | Clear error messages and help tooltips |

---

## Communication Plan

**User Updates:**
- After PR-1: "Investigating balance issue, app may be read-only temporarily"
- After PR-2: "Balance fix deployed, please verify against bank statement"
- After PR-4: "Historical data imported, full transaction history available"
- After PR-6: "Balance validation complete, system stable"

---

## Next Action

**EXECUTE PR-1:** Run diagnostic queries to confirm hypothesis

**Command:**
```bash
cd /home/ekla/DevProjects/MVP/florin
npm run tauri dev
```

Then access database location and run diagnostic SQL from `diagnostic-balance.md`.
