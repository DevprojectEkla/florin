import { getDb } from './client';

/**
 * Compute the current bank balance from static data:
 * opening_balance (earliest fiscal year) + total credits - total debits
 * across ALL transactions ever imported.
 *
 * This should match the real bank balance. If it doesn't, there's
 * an error or missing transaction somewhere.
 */
export async function computeCurrentBalance(): Promise<{
  balance: number;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  startDate: string | null;
}> {
  const db = await getDb();

  // Get the opening balance from the earliest fiscal year
  const fyRows = await db.select<{ opening_balance: number | null; start_year: number; start_month: number }[]>(
    `SELECT opening_balance, start_year, start_month
     FROM fiscal_years
     ORDER BY start_year ASC, start_month ASC
     LIMIT 1`
  );
  const openingBalance = fyRows[0]?.opening_balance ?? 0;

  // Sum all credits and debits across all transactions
  const totals = await db.select<{
    total_credits: number;
    total_debits: number;
    tx_count: number;
    min_date: string | null;
  }[]>(
    `SELECT
       COALESCE(SUM(credit), 0) as total_credits,
       COALESCE(SUM(debit), 0) as total_debits,
       COUNT(*) as tx_count,
       MIN(date) as min_date
     FROM transactions`
  );

  const totalCredits = totals[0]?.total_credits ?? 0;
  const totalDebits = totals[0]?.total_debits ?? 0;
  const transactionCount = totals[0]?.tx_count ?? 0;
  const startDate = totals[0]?.min_date ?? null;

  return {
    balance: openingBalance + totalCredits - totalDebits,
    openingBalance,
    totalCredits,
    totalDebits,
    transactionCount,
    startDate,
  };
}
