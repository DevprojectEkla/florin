# Balance Discrepancy Diagnostic Report

## Problem Statement
- **Expected Balance**: €229.90 (from CA bank statement dated 26/06/2026)
- **Actual Application Balance**: €2,614.49
- **Discrepancy**: €2,384.59 (over-reported)

## Root Cause Hypotheses

### H1: Opening Balance Incorrect (HIGH PROBABILITY)
**Evidence:**
- ODS file shows "CAPITAL 31/08/2025" = €1,930.115
- ODS file shows "rep.à nouv. 8/2025" = €2,413.32
- These values differ by €483.21

**Test:** Query `fiscal_years.opening_balance` for 2025-2026 fiscal year

### H2: Duplicate Transactions (MEDIUM PROBABILITY)
**Evidence:**
- Dedup uses `dedupKey(date, label, amount)`
- Bank labels often have inconsistent formatting

**Test:** Check for duplicate transactions with same date/amount but different labels

### H3: Wrong Transaction Signs (MEDIUM PROBABILITY)
**Evidence:**
- Credits/debits might be reversed in import

**Test:** Verify sum(credit) - sum(debit) matches expected net change

### H4: Fiscal Year Boundary (LOW PROBABILITY)
**Evidence:**
- Balance calculation filters by `fiscal_year_id`

**Test:** Check transaction date ranges vs fiscal year definition

## Required Data Extraction

### From Database:
```sql
-- 1. Fiscal year configuration
SELECT id, label, start_year, start_month, opening_balance 
FROM fiscal_years 
ORDER BY start_year DESC, start_month DESC;

-- 2. Transaction summary
SELECT 
  fiscal_year_id,
  COUNT(*) as tx_count,
  SUM(credit) as total_credits,
  SUM(debit) as total_debits,
  MIN(date) as first_tx,
  MAX(date) as last_tx
FROM transactions 
GROUP BY fiscal_year_id;

-- 3. Duplicate check
SELECT date, label, debit, credit, COUNT(*) as cnt
FROM transactions
GROUP BY date, label, debit, credit
HAVING cnt > 1;

-- 4. Balance calculation verification
SELECT 
  opening_balance,
  (SELECT SUM(credit) FROM transactions WHERE fiscal_year_id = 
    (SELECT id FROM fiscal_years ORDER BY start_year DESC LIMIT 1)) as credits,
  (SELECT SUM(debit) FROM transactions WHERE fiscal_year_id = 
    (SELECT id FROM fiscal_years ORDER BY start_year DESC LIMIT 1)) as debits
FROM fiscal_years 
ORDER BY start_year DESC LIMIT 1;
```

### From ODS File:
- ✅ Opening balance (CAPITAL 31/08/2025): €1,930.115
- ✅ Brought forward balance (rep.à nouv. 8/2025): €2,413.32
- ✅ Monthly transactions through June 2026

### From CA File:
- ✅ Bank balance as of 26/06/2026: €229.90
- Transaction count: ~42-43 rows

## Next Steps

1. **Run Application**: Launch florin app to access database
2. **Execute SQL Diagnostics**: Run queries above
3. **Compare**: Opening balance in DB vs ODS file
4. **Verify**: Transaction count and sums
5. **Identify**: Specific discrepancy source
