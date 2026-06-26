-- ============================================================
-- BALANCE FIX - QUICK SOLUTION
-- ============================================================
-- This script fixes the balance discrepancy by setting the
-- correct opening balance based on CA bank statement analysis.
--
-- PREREQUISITE: Import CA20260626_215551.xlsx first
-- ============================================================

-- Option 1: If CA file with May 30 - June 26 is imported (33 transactions)
-- Set opening balance to May 30, 2026 balance
UPDATE fiscal_years 
SET opening_balance = 2072.71,
    balance_verified_at = datetime('now'),
    balance_source = 'CA bank statement 2026-05-30',
    notes = 'Opening balance adjusted based on CA20260626_215551.xlsx analysis. Balance at May 30, 2026 was €2,072.71. After importing 33 transactions (1 from May 30, 32 from June 1-26), the ending balance matches bank statement of €229.90.'
WHERE start_year = 2025 AND start_month = 9;

-- Log the adjustment
INSERT INTO balance_audit_log (fiscal_year_id, old_opening_balance, new_opening_balance, reason, performed_by)
SELECT 
  id,
  opening_balance,
  2072.71,
  'Corrected based on CA bank statement analysis. CA file covers May 30 - June 26, 2026 with 33 transactions totaling €-1,842.81 net change. Bank balance on June 26 is €229.90, which reverse-calculates to €2,072.71 on May 30.',
  'balance_fix_script'
FROM fiscal_years 
WHERE start_year = 2025 AND start_month = 9;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this to verify the fix worked:

SELECT 
  'Expected Balance' as check_type,
  '€229.90' as expected,
  '€' || ROUND(fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0), 2) as calculated,
  CASE 
    WHEN ABS((fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0)) - 229.90) < 0.01 
    THEN '✓ CORRECT' 
    ELSE '❌ WRONG (diff: €' || ROUND(ABS((fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0)) - 229.90), 2) || ')'
  END as status,
  COUNT(t.id) as transaction_count,
  MIN(t.date) as first_tx_date,
  MAX(t.date) as last_tx_date
FROM fiscal_years fy
LEFT JOIN transactions t ON t.fiscal_year_id = fy.id
WHERE fy.start_year = 2025 AND fy.start_month = 9
GROUP BY fy.id;

-- ============================================================
-- TRANSACTION SUMMARY
-- ============================================================
SELECT 
  'May transactions' as period,
  COUNT(*) as count,
  ROUND(COALESCE(SUM(credit), 0), 2) as total_credits,
  ROUND(COALESCE(SUM(debit), 0), 2) as total_debits,
  ROUND(COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0), 2) as net
FROM transactions
WHERE fiscal_year_id = (SELECT id FROM fiscal_years WHERE start_year = 2025 AND start_month = 9)
  AND date LIKE '2026-05-%'

UNION ALL

SELECT 
  'June transactions' as period,
  COUNT(*) as count,
  ROUND(COALESCE(SUM(credit), 0), 2) as total_credits,
  ROUND(COALESCE(SUM(debit), 0), 2) as total_debits,
  ROUND(COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0), 2) as net
FROM transactions
WHERE fiscal_year_id = (SELECT id FROM fiscal_years WHERE start_year = 2025 AND start_month = 9)
  AND date LIKE '2026-06-%'

UNION ALL

SELECT 
  'TOTAL' as period,
  COUNT(*) as count,
  ROUND(COALESCE(SUM(credit), 0), 2) as total_credits,
  ROUND(COALESCE(SUM(debit), 0), 2) as total_debits,
  ROUND(COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0), 2) as net
FROM transactions
WHERE fiscal_year_id = (SELECT id FROM fiscal_years WHERE start_year = 2025 AND start_month = 9);

-- ============================================================
-- EXPECTED RESULTS:
-- ============================================================
-- Transaction count: 33 (1 May + 32 June)
-- Total credits: €300.00
-- Total debits: €2,142.81
-- Net change: €-1,842.81
-- Opening balance: €2,072.71
-- Calculated balance: €229.90 ✓
-- ============================================================
