import { getDb } from './client';

/**
 * Compute the current bank balance from static data.
 * 
 * Strategy: Use the LATEST fiscal year's opening_balance as anchor point,
 * then add all credits and subtract all debits for that fiscal year's transactions.
 * 
 * This avoids accumulating errors from older years where extraction may be imperfect.
 * The opening_balance is a known-good value from the bank statement.
 */
export async function computeCurrentBalance(): Promise<{
  balance: number;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  startDate: string | null;
  fiscalYearLabel: string | null;
}> {
  const db = await getDb();

  // Get the latest fiscal year (most recent = best anchor)
  const fyRows = await db.select<{
    id: number; opening_balance: number | null; label: string;
  }[]>(
    `SELECT id, opening_balance, label
     FROM fiscal_years
     ORDER BY start_year DESC, start_month DESC
     LIMIT 1`
  );

  if (fyRows.length === 0) {
    return { balance: 0, openingBalance: 0, totalCredits: 0, totalDebits: 0, transactionCount: 0, startDate: null, fiscalYearLabel: null };
  }

  const fy = fyRows[0];
  const openingBalance = fy.opening_balance ?? 0;

  // Sum credits and debits for this fiscal year only
  const totals = await db.select<{
    total_credits: number; total_debits: number;
    tx_count: number; min_date: string | null;
  }[]>(
    `SELECT
       COALESCE(SUM(credit), 0) as total_credits,
       COALESCE(SUM(debit), 0) as total_debits,
       COUNT(*) as tx_count,
       MIN(date) as min_date
     FROM transactions
     WHERE fiscal_year_id = ?`,
    [fy.id]
  );

  const totalCredits = totals[0]?.total_credits ?? 0;
  const totalDebits = totals[0]?.total_debits ?? 0;

  return {
    balance: openingBalance + totalCredits - totalDebits,
    openingBalance,
    totalCredits,
    totalDebits,
    transactionCount: totals[0]?.tx_count ?? 0,
    startDate: totals[0]?.min_date ?? null,
    fiscalYearLabel: fy.label,
  };
}

/**
 * Compute balance at a specific date (for validation).
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Balance at end of that date
 */
export async function computeBalanceAtDate(date: string): Promise<number> {
  const db = await getDb();

  // Get the fiscal year for this date
  const fyRows = await db.select<{
    id: number; opening_balance: number | null;
  }[]>(
    `SELECT id, opening_balance
     FROM fiscal_years
     ORDER BY start_year DESC, start_month DESC
     LIMIT 1`
  );

  if (fyRows.length === 0) return 0;

  const fy = fyRows[0];
  const openingBalance = fy.opening_balance ?? 0;

  // Sum transactions up to and including this date
  const totals = await db.select<{
    total_credits: number; total_debits: number;
  }[]>(
    `SELECT
       COALESCE(SUM(credit), 0) as total_credits,
       COALESCE(SUM(debit), 0) as total_debits
     FROM transactions
     WHERE fiscal_year_id = ? AND date <= ?`,
    [fy.id, date]
  );

  const totalCredits = totals[0]?.total_credits ?? 0;
  const totalDebits = totals[0]?.total_debits ?? 0;

  return openingBalance + totalCredits - totalDebits;
}

/**
 * Balance checkpoint from import batch.
 */
export interface BalanceCheckpoint {
  date: string;
  expected: number;
  calculated: number;
  discrepancy: number;
  source: string;
}

/**
 * Validate balance against known checkpoints (from CA imports).
 * 
 * Returns list of discrepancies where calculated balance doesn't match
 * the bank statement balance.
 */
export async function validateBalanceCheckpoints(): Promise<BalanceCheckpoint[]> {
  const db = await getDb();

  // Get import batches with balance_at_import
  const batches = await db.select<{
    period_to: string | null;
    balance_at_import: number | null;
    filename: string;
  }[]>(
    `SELECT period_to, balance_at_import, filename
     FROM import_batches
     WHERE balance_at_import IS NOT NULL
     ORDER BY period_to ASC`
  );

  const checkpoints: BalanceCheckpoint[] = [];

  for (const batch of batches) {
    if (!batch.period_to || batch.balance_at_import === null) continue;

    const calculated = await computeBalanceAtDate(batch.period_to);
    const discrepancy = calculated - batch.balance_at_import;

    checkpoints.push({
      date: batch.period_to,
      expected: batch.balance_at_import,
      calculated,
      discrepancy,
      source: batch.filename,
    });
  }

  return checkpoints;
}
