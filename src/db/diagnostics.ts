/**
 * Database diagnostic utilities for troubleshooting balance discrepancies.
 * 
 * Usage: Import in dev tools or create admin page to display diagnostics.
 */

import { getDb } from './client';

export interface FiscalYearDiagnostic {
  id: number;
  label: string;
  start_year: number;
  start_month: number;
  opening_balance: number | null;
  transaction_count: number;
  total_credits: number;
  total_debits: number;
  net_change: number;
  calculated_balance: number;
  first_transaction_date: string | null;
  last_transaction_date: string | null;
}

export interface DuplicateTransaction {
  date: string;
  label: string;
  debit: number | null;
  credit: number | null;
  count: number;
  transaction_ids: number[];
}

export interface BalanceDiagnosticReport {
  fiscal_years: FiscalYearDiagnostic[];
  duplicates: DuplicateTransaction[];
  import_batches: ImportBatchSummary[];
  balance_checkpoints: BalanceCheckpoint[];
}

export interface ImportBatchSummary {
  id: number;
  filename: string;
  imported_at: string;
  account_number_raw: string | null;
  balance_at_import: number | null;
  period_from: string | null;
  period_to: string | null;
  rows_imported: number;
  rows_skipped: number;
}

export interface BalanceCheckpoint {
  date: string;
  description: string;
  calculated_balance: number;
  expected_balance: number | null;
  discrepancy: number | null;
}

/**
 * Get comprehensive diagnostic report for all fiscal years.
 */
export async function getDiagnosticReport(): Promise<BalanceDiagnosticReport> {
  const fiscal_years = await getFiscalYearDiagnostics();
  const duplicates = await findDuplicateTransactions();
  const import_batches = await getImportBatchSummaries();
  const balance_checkpoints = await getBalanceCheckpoints();

  return {
    fiscal_years,
    duplicates,
    import_batches,
    balance_checkpoints,
  };
}

/**
 * Analyze each fiscal year's transactions and balance.
 */
export async function getFiscalYearDiagnostics(): Promise<FiscalYearDiagnostic[]> {
  const db = await getDb();

  const fiscalYears = await db.select<{
    id: number;
    label: string;
    start_year: number;
    start_month: number;
    opening_balance: number | null;
  }[]>('SELECT id, label, start_year, start_month, opening_balance FROM fiscal_years ORDER BY start_year DESC, start_month DESC');

  const diagnostics: FiscalYearDiagnostic[] = [];

  for (const fy of fiscalYears) {
    const stats = await db.select<{
      tx_count: number;
      total_credits: number;
      total_debits: number;
      min_date: string | null;
      max_date: string | null;
    }[]>(
      `SELECT
         COUNT(*) as tx_count,
         COALESCE(SUM(credit), 0) as total_credits,
         COALESCE(SUM(debit), 0) as total_debits,
         MIN(date) as min_date,
         MAX(date) as max_date
       FROM transactions
       WHERE fiscal_year_id = ?`,
      [fy.id]
    );

    const s = stats[0] || { tx_count: 0, total_credits: 0, total_debits: 0, min_date: null, max_date: null };
    const opening = fy.opening_balance ?? 0;
    const net_change = s.total_credits - s.total_debits;
    const calculated_balance = opening + net_change;

    diagnostics.push({
      id: fy.id,
      label: fy.label,
      start_year: fy.start_year,
      start_month: fy.start_month,
      opening_balance: fy.opening_balance,
      transaction_count: s.tx_count,
      total_credits: s.total_credits,
      total_debits: s.total_debits,
      net_change,
      calculated_balance,
      first_transaction_date: s.min_date,
      last_transaction_date: s.max_date,
    });
  }

  return diagnostics;
}

/**
 * Find transactions that may be duplicates (same date, label, and amount).
 */
export async function findDuplicateTransactions(): Promise<DuplicateTransaction[]> {
  const db = await getDb();

  const dupes = await db.select<{
    date: string;
    label: string;
    debit: number | null;
    credit: number | null;
    count: number;
  }[]>(
    `SELECT date, label, debit, credit, COUNT(*) as count
     FROM transactions
     GROUP BY date, label, debit, credit
     HAVING count > 1
     ORDER BY date DESC, count DESC`
  );

  const results: DuplicateTransaction[] = [];

  for (const dupe of dupes) {
    const ids = await db.select<{ id: number }[]>(
      `SELECT id FROM transactions 
       WHERE date = ? AND label = ? AND debit IS ? AND credit IS ?`,
      [dupe.date, dupe.label, dupe.debit, dupe.credit]
    );

    results.push({
      date: dupe.date,
      label: dupe.label,
      debit: dupe.debit,
      credit: dupe.credit,
      count: dupe.count,
      transaction_ids: ids.map((r) => r.id),
    });
  }

  return results;
}

/**
 * Get summary of all import batches.
 */
export async function getImportBatchSummaries(): Promise<ImportBatchSummary[]> {
  const db = await getDb();

  return db.select<ImportBatchSummary[]>(
    `SELECT
       id,
       filename,
       imported_at,
       account_number_raw,
       balance_at_import,
       period_from,
       period_to,
       rows_imported,
       rows_skipped
     FROM import_batches
     ORDER BY imported_at DESC`
  );
}

/**
 * Calculate balance at specific dates and compare with expected values.
 */
export async function getBalanceCheckpoints(): Promise<BalanceCheckpoint[]> {
  const db = await getDb();

  // Get the latest fiscal year
  const fyRows = await db.select<{
    id: number;
    opening_balance: number | null;
  }[]>('SELECT id, opening_balance FROM fiscal_years ORDER BY start_year DESC, start_month DESC LIMIT 1');

  if (fyRows.length === 0) {
    return [];
  }

  const fy = fyRows[0];
  const opening_balance = fy.opening_balance ?? 0;

  // Get import batch ending balances
  const batches = await db.select<{
    period_to: string | null;
    balance_at_import: number | null;
    filename: string;
  }[]>(
    `SELECT period_to, balance_at_import, filename
     FROM import_batches
     WHERE fiscal_year_id = ? AND balance_at_import IS NOT NULL
     ORDER BY period_to ASC`,
    [fy.id]
  );

  const checkpoints: BalanceCheckpoint[] = [];

  for (const batch of batches) {
    if (!batch.period_to) continue;

    // Calculate balance at this date
    const txStats = await db.select<{
      total_credits: number;
      total_debits: number;
    }[]>(
      `SELECT
         COALESCE(SUM(credit), 0) as total_credits,
         COALESCE(SUM(debit), 0) as total_debits
       FROM transactions
       WHERE fiscal_year_id = ? AND date <= ?`,
      [fy.id, batch.period_to]
    );

    const calculated = opening_balance + txStats[0].total_credits - txStats[0].total_debits;
    const expected = batch.balance_at_import;
    const discrepancy = expected ? calculated - expected : null;

    checkpoints.push({
      date: batch.period_to,
      description: `End of import: ${batch.filename}`,
      calculated_balance: calculated,
      expected_balance: expected,
      discrepancy,
    });
  }

  return checkpoints;
}

/**
 * Format diagnostic report as human-readable text.
 */
export function formatDiagnosticReport(report: BalanceDiagnosticReport): string {
  let output = '=== BALANCE DIAGNOSTIC REPORT ===\n\n';

  // Fiscal Years
  output += '--- FISCAL YEARS ---\n';
  for (const fy of report.fiscal_years) {
    output += `\nFiscal Year: ${fy.label} (${fy.start_year}-${fy.start_month})\n`;
    output += `  Opening Balance: €${(fy.opening_balance ?? 0).toFixed(2)}\n`;
    output += `  Transactions: ${fy.transaction_count}\n`;
    output += `  Date Range: ${fy.first_transaction_date || 'N/A'} to ${fy.last_transaction_date || 'N/A'}\n`;
    output += `  Total Credits: €${fy.total_credits.toFixed(2)}\n`;
    output += `  Total Debits: €${fy.total_debits.toFixed(2)}\n`;
    output += `  Net Change: €${fy.net_change.toFixed(2)}\n`;
    output += `  Calculated Balance: €${fy.calculated_balance.toFixed(2)}\n`;
  }

  // Duplicates
  output += '\n--- DUPLICATE TRANSACTIONS ---\n';
  if (report.duplicates.length === 0) {
    output += 'No duplicates found ✓\n';
  } else {
    for (const dupe of report.duplicates) {
      output += `\n${dupe.date} | ${dupe.label.slice(0, 40)}\n`;
      output += `  Count: ${dupe.count}\n`;
      output += `  Amount: D:${dupe.debit ?? '-'} C:${dupe.credit ?? '-'}\n`;
      output += `  IDs: ${dupe.transaction_ids.join(', ')}\n`;
    }
  }

  // Import Batches
  output += '\n--- IMPORT BATCHES ---\n';
  for (const batch of report.import_batches) {
    output += `\n${batch.imported_at} | ${batch.filename}\n`;
    output += `  Period: ${batch.period_from || 'N/A'} to ${batch.period_to || 'N/A'}\n`;
    output += `  Imported: ${batch.rows_imported}, Skipped: ${batch.rows_skipped}\n`;
    if (batch.balance_at_import) {
      output += `  Balance at Import: €${batch.balance_at_import.toFixed(2)}\n`;
    }
  }

  // Balance Checkpoints
  output += '\n--- BALANCE CHECKPOINTS ---\n';
  for (const cp of report.balance_checkpoints) {
    const status = cp.discrepancy && Math.abs(cp.discrepancy) > 0.01 ? '❌' : '✓';
    output += `\n${cp.date} | ${cp.description} ${status}\n`;
    output += `  Calculated: €${cp.calculated_balance.toFixed(2)}\n`;
    output += `  Expected: €${cp.expected_balance?.toFixed(2) ?? 'N/A'}\n`;
    if (cp.discrepancy) {
      output += `  Discrepancy: €${cp.discrepancy.toFixed(2)}\n`;
    }
  }

  return output;
}
