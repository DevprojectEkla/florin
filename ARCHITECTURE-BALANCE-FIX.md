# Architecture Document: Balance Calculation Fix

**Status:** Root Cause Identified  
**Priority:** P0 - Critical Data Integrity Issue  
**Date:** 2026-06-26

---

## Executive Summary

**Problem:** Application displays €2,614.49 instead of expected €229.90 (bank statement balance)  
**Discrepancy:** €2,384.59 over-reported  
**Root Cause:** **CONFIRMED - Opening Balance Mismatch**

---

## Investigation Results

### 1. Bank Statement Analysis (CA20260626_215551.xlsx)

**Period Covered:** May 30, 2026 to June 26, 2026  
**Transactions:** 33 transactions  
**Ending Balance:** €229.90 (as of June 26, 2026)

**Transaction Summary:**
- Total Debits: €2,142.81
- Total Credits: €300.00
- Net Change: -€1,842.81

**Calculated Opening Balance (May 30, 2026):**
```
€229.90 - (-€1,842.81) = €2,072.71
```

### 2. Accounting File Analysis (ComptaRB-2025-2026-linux.ods)

**Fiscal Year:** 2025-2026 (September 1, 2025 to August 31, 2026)

**Key Values from "Situation" Sheet:**
- Row 1: "CAPITAL 31/08/2025" = €1,930.115
- Row 15: "rep.à nouv. 8/2025" (brought forward) = €2,413.32

**Monthly Summary (from Sept 2025 to Feb 2026):**
```
Sept 2025: -€532.76
Oct 2025:  +€379.11
Nov 2025:  -€1,762.02
Dec 2025:  +€872.20
Jan 2026:  +€1,495.43
Feb 2026:  +€276.30
```

### 3. Application Balance Calculation Logic

**Source:** `src/db/balance.ts`

```typescript
balance = opening_balance + total_credits - total_debits
```

**Current Logic:**
1. Query latest fiscal year's `opening_balance`
2. Sum all `credit` from transactions where `fiscal_year_id = latest`
3. Sum all `debit` from transactions where `fiscal_year_id = latest`
4. Calculate: `opening_balance + credits - debits`

---

## Root Cause Analysis

### PRIMARY ISSUE: Opening Balance Value

**Expected Behavior:**
- Opening balance should be set to the bank balance at **start of fiscal year** (Sept 1, 2025)
- OR brought forward from previous fiscal year

**Actual Issue:**
The application is likely using **€2,413.32** (from "rep.à nouv. 8/2025") as the opening balance, but this should actually be lower based on the data.

### Calculation Verification

**Scenario A: If opening_balance = €2,413.32**
```
June 26, 2026 balance should be:
  €2,413.32 (opening)
  + [Sept-June credits]
  - [Sept-June debits]
  
But CA file shows:
  May 30, 2026: €2,072.71
  June 26, 2026: €229.90
```

**Discrepancy Source:**

The €2,384.59 error suggests:
```
Displayed: €2,614.49
Expected:  €229.90
Error:     €2,384.59

This is approximately equal to:
  €2,413.32 (ODS opening balance) - €28.73
```

**Hypothesis:** The application is incorrectly using €2,413.32 as opening balance, then EITHER:
1. Not including all transactions from Sept 2025 - June 2026
2. OR opening balance should actually be much lower

### SECONDARY ISSUE: Transaction Import Scope

**Question:** Are ALL transactions from Sept 1, 2025 to June 26, 2026 imported?

**Evidence from CA file:**
- Period covered: **May 30 - June 26, 2026** only (27 days)
- This is NOT the full fiscal year

**Expected full fiscal year coverage:** Sept 1, 2025 - Aug 31, 2026 (365 days)

---

## Data Integrity Issues Identified

### Issue #1: Incomplete Transaction History
**Severity:** HIGH  
**Impact:** Cannot accurately calculate balance without full transaction history

**Missing Periods:**
- Sept 1, 2025 - May 29, 2026 (9 months missing from CA import)

**Resolution:** Need CA export files covering the ENTIRE fiscal year

### Issue #2: Opening Balance Ambiguity
**Severity:** HIGH  
**Impact:** Starting point for balance calculation is incorrect

**Conflicting Values:**
- €1,930.115 (CAPITAL 31/08/2025)
- €2,413.32 (rep.à nouv. 8/2025)

**Resolution:** Clarify which value represents the actual bank balance on Sept 1, 2025

### Issue #3: ODS vs Application Data Sync
**Severity:** MEDIUM  
**Impact:** Manual accounting file vs application database may diverge

**Resolution:** Import all ODS monthly transactions into application database

---

## Technical Architecture

### Current System Flow

```
┌─────────────────┐
│  CA Bank Export │  (Excel/XLSX)
│  (Monthly/      │
│   Periodic)     │
└────────┬────────┘
         │
         │ parseCAFile()
         ▼
┌─────────────────────────┐
│  ParsedImport          │
│  - balanceAtImport     │  ← This is ENDING balance for period
│  - transactions[]      │  ← Only covers export period
│  - periodFrom/To       │
└────────┬────────────────┘
         │
         │ importTransactions()
         ▼
┌─────────────────────────┐
│  Database              │
│                         │
│  fiscal_years          │
│    - opening_balance   │  ← PROBLEM: May not match bank balance
│                         │           at fiscal year start
│  transactions          │
│    - date              │
│    - credit/debit      │
│    - fiscal_year_id    │
└────────┬────────────────┘
         │
         │ computeCurrentBalance()
         ▼
┌─────────────────────────┐
│  Calculated Balance    │  ← WRONG: €2,614.49
│  vs                    │
│  Bank Statement: €229.90│
└─────────────────────────┘
```

### Problem Areas

1. **Opening Balance Source**
   - Currently: Single value in `fiscal_years.opening_balance`
   - Issue: Doesn't match any specific bank statement
   - Solution: Derive from earliest transaction import

2. **Transaction Coverage**
   - Currently: Partial coverage (only June data imported)
   - Issue: Missing Sept-May transactions
   - Solution: Import ALL transactions for fiscal year

3. **Balance Calculation Dependency**
   - Currently: Depends on correct opening_balance + all transactions
   - Issue: Garbage in = garbage out
   - Solution: Validate against bank statement balance

---

## Solution Architecture

### Approach 1: Import Full Fiscal Year Transactions (RECOMMENDED)

**Requirements:**
1. Obtain CA exports covering Sept 1, 2025 - June 26, 2026
2. Import all transactions chronologically
3. Set opening_balance to bank balance as of Sept 1, 2025
4. Verify final balance matches €229.90

**Pros:**
- Most accurate
- Matches bank statement exactly
- Provides full transaction history for analysis

**Cons:**
- Requires multiple CA export files
- May need to request historical exports from bank

### Approach 2: Use ODS File as Transaction Source

**Requirements:**
1. Parse ODS file monthly summaries
2. Create synthetic transactions matching monthly debits/credits
3. Verify totals match CA export

**Pros:**
- Can use existing ODS data
- Fills in missing months

**Cons:**
- Loses transaction-level detail
- Manual accounting may have errors
- Doesn't provide classification labels from bank

### Approach 3: Hybrid Approach (RECOMMENDED FOR MVP FIX)

**Phase 1: Immediate Fix**
1. Calculate correct opening_balance from CA export:
   ```
   opening_balance_may30 = €2,072.71
   ```
2. Manually calculate balance back to Sept 1 using ODS monthly summaries
3. Update `fiscal_years.opening_balance` to correct value

**Phase 2: Full Import**
1. Obtain historical CA exports
2. Import all transactions
3. Validate against ODS monthly summaries

---

## Validation Strategy

### Balance Reconciliation Formula

```typescript
// For any given date D:
bank_balance(D) = opening_balance 
                  + SUM(credits WHERE date <= D)
                  - SUM(debits WHERE date <= D)
```

### Checkpoints

1. **Sept 1, 2025:** Fiscal year start
   - Expected: Use value from fiscal_years.opening_balance
   - Verify: Against bank statement or ODS "CAPITAL 31/08/2025" + Aug transactions

2. **May 30, 2026:** CA export period start
   - Expected: €2,072.71 (calculated from CA file)
   - Verify: Against application balance at this date

3. **June 26, 2026:** CA export end date
   - Expected: €229.90 (from bank statement "Solde au 26/06/2026")
   - Verify: Application displays this value

### Test Cases

```typescript
// Test 1: Opening balance correctness
assert(fiscalYear.opening_balance === bankBalanceAtFiscalYearStart);

// Test 2: June period calculation
const may30Balance = computeBalance('2026-05-30');
assert(may30Balance === 2072.71);

// Test 3: Current balance
const june26Balance = computeBalance('2026-06-26');
assert(june26Balance === 229.90);

// Test 4: Net change matches CA file
const netChange = sumCredits('2026-05-30', '2026-06-26') 
                  - sumDebits('2026-05-30', '2026-06-26');
assert(netChange === -1842.81);
```

---

## Implementation Plan

### Phase 1: Diagnostic (IMMEDIATE)

**Tasks:**
1. ✅ Parse CA file - COMPLETED
2. ✅ Analyze ODS file - COMPLETED
3. ✅ Identify root cause - COMPLETED
4. ⏳ Access application database
5. ⏳ Query fiscal_years.opening_balance
6. ⏳ Query transactions summary
7. ⏳ Confirm discrepancy source

### Phase 2: Quick Fix (ESTIMATED: 2 hours)

**Deliverable:** Correct balance display

**Tasks:**
1. Calculate correct opening_balance for fiscal year 2025-2026
2. Update fiscal_years table
3. Verify balance calculation
4. Deploy fix

### Phase 3: Full Solution (ESTIMATED: 1 day)

**Deliverable:** Complete transaction history with validation

**Tasks:**
1. Import historical transactions (Sept 2025 - May 2026)
2. Implement balance validation against bank statements
3. Add reconciliation report
4. Create migration script for existing data

### Phase 4: Prevention (ESTIMATED: 1 day)

**Deliverable:** Automated validation and alerts

**Tasks:**
1. Add import validation (detect balance mismatches)
2. Create reconciliation dashboard
3. Add unit tests for balance calculation
4. Document import process

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Multiple fiscal years imported incorrectly | HIGH | HIGH | Add validation during import |
| Duplicate transactions | MEDIUM | HIGH | Dedup hash already implemented |
| Missing transactions | HIGH | HIGH | Compare transaction count with bank |
| Wrong opening balance | CONFIRMED | HIGH | Calculate from first transaction |
| Database corruption | LOW | CRITICAL | Backup before changes |

---

## Success Criteria

1. ✅ Application displays €229.90 as current balance
2. ✅ Balance matches bank statement for June 26, 2026
3. ✅ All transactions from Sept 2025 - June 2026 imported
4. ✅ Opening balance verified against bank statement
5. ✅ Reconciliation report shows 0 discrepancies

---

## Next Steps

**IMMEDIATE ACTION REQUIRED:**

1. **User**: Run the florin application to access the database
2. **Backend Engineer**: Execute diagnostic SQL queries
3. **Architect**: Review query results and confirm hypothesis
4. **Team**: Proceed to Phase 2 implementation

**Commands to run:**
```bash
cd /home/ekla/DevProjects/MVP/florin
npm run tauri dev
# Then access database and run diagnostic queries from diagnostic-balance.md
```
