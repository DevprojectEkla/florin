#!/usr/bin/env node
/**
 * Check balance diagnostic - requires running Tauri app with database.
 * 
 * This script demonstrates how to access the diagnostic functions.
 * In practice, this would be called from the application itself or
 * through Tauri commands.
 * 
 * For now, it provides SQL queries that can be run manually.
 */

console.log('=== BALANCE DIAGNOSTIC TOOL ===\n');
console.log('This script provides SQL queries to run against florin.db');
console.log('Database location: Check Tauri app data directory\n');
console.log('On Linux: ~/.local/share/florin/ or similar\n');

console.log('--- SQL DIAGNOSTIC QUERIES ---\n');

console.log('1. FISCAL YEARS SUMMARY:\n');
console.log(`
SELECT 
  fy.id,
  fy.label,
  fy.start_year,
  fy.start_month,
  fy.opening_balance,
  COUNT(t.id) as tx_count,
  COALESCE(SUM(t.credit), 0) as total_credits,
  COALESCE(SUM(t.debit), 0) as total_debits,
  COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0) as net_change,
  fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0) as calculated_balance,
  MIN(t.date) as first_tx_date,
  MAX(t.date) as last_tx_date
FROM fiscal_years fy
LEFT JOIN transactions t ON t.fiscal_year_id = fy.id
GROUP BY fy.id
ORDER BY fy.start_year DESC, fy.start_month DESC;
`);

console.log('\n2. DUPLICATE TRANSACTIONS CHECK:\n');
console.log(`
SELECT 
  date,
  label,
  debit,
  credit,
  COUNT(*) as duplicate_count,
  GROUP_CONCAT(id) as transaction_ids
FROM transactions
GROUP BY date, label, debit, credit
HAVING duplicate_count > 1
ORDER BY date DESC, duplicate_count DESC;
`);

console.log('\n3. IMPORT BATCHES SUMMARY:\n');
console.log(`
SELECT
  id,
  filename,
  imported_at,
  account_number_raw,
  balance_at_import,
  period_from,
  period_to,
  rows_imported,
  rows_skipped,
  rows_conflicted
FROM import_batches
ORDER BY imported_at DESC;
`);

console.log('\n4. BALANCE AT SPECIFIC DATES:\n');
console.log(`
-- Balance as of June 26, 2026
SELECT 
  fy.opening_balance as opening,
  COALESCE(SUM(t.credit), 0) as credits,
  COALESCE(SUM(t.debit), 0) as debits,
  fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0) as calculated_balance
FROM fiscal_years fy
LEFT JOIN transactions t ON t.fiscal_year_id = fy.id AND t.date <= '2026-06-26'
WHERE fy.start_year = 2025 AND fy.start_month = 9
GROUP BY fy.id;

-- Balance as of May 30, 2026 (should be €2,072.71)
SELECT 
  fy.opening_balance as opening,
  COALESCE(SUM(t.credit), 0) as credits,
  COALESCE(SUM(t.debit), 0) as debits,
  fy.opening_balance + COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0) as calculated_balance
FROM fiscal_years fy
LEFT JOIN transactions t ON t.fiscal_year_id = fy.id AND t.date <= '2026-05-30'
WHERE fy.start_year = 2025 AND fy.start_month = 9
GROUP BY fy.id;
`);

console.log('\n5. TRANSACTION COUNT BY MONTH:\n');
console.log(`
SELECT
  strftime('%Y-%m', date) as month,
  COUNT(*) as tx_count,
  COALESCE(SUM(credit), 0) as credits,
  COALESCE(SUM(debit), 0) as debits,
  COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as net
FROM transactions
WHERE fiscal_year_id = (SELECT id FROM fiscal_years ORDER BY start_year DESC, start_month DESC LIMIT 1)
GROUP BY month
ORDER BY month DESC;
`);

console.log('\n--- HOW TO RUN THESE QUERIES ---\n');
console.log('1. Start the florin application:');
console.log('   cd /home/ekla/DevProjects/MVP/florin');
console.log('   npm run tauri dev\n');
console.log('2. Find the database file:');
console.log('   - Linux: ~/.local/share/com.florin.app/ or similar');
console.log('   - Check Tauri logs for actual path\n');
console.log('3. Open with sqlite3:');
console.log('   sqlite3 /path/to/florin.db\n');
console.log('4. Run the queries above\n');
console.log('5. Compare results with expected values:');
console.log('   - Expected balance (June 26, 2026): €229.90');
console.log('   - Expected balance (May 30, 2026): €2,072.71');
console.log('   - Opening balance (Sept 1, 2025): TBD from query results\n');

console.log('--- EXPECTED VS ACTUAL COMPARISON ---\n');
console.log('From CA bank statement analysis:');
console.log('  Period: May 30 - June 26, 2026');
console.log('  Transactions: 33');
console.log('  Total Credits: €300.00');
console.log('  Total Debits: €2,142.81');
console.log('  Net Change: -€1,842.81');
console.log('  Ending Balance: €229.90');
console.log('  Calculated Opening (May 30): €2,072.71\n');
console.log('If database shows different values, this confirms the discrepancy!\n');
