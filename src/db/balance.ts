import { getDb } from './client';

/**
 * Compute the current bank balance from static data.
 *
 * Strategy: Anchor on the CURRENT (latest) fiscal year's opening_balance,
 * which is the prior year's audited closing balance carried forward, then
 * add ALL credits and subtract ALL debits recorded from that fiscal year's
 * start date onward.
 *
 * This is standard accounting practice: each fiscal year opens with the
 * previous year's verified closing balance. Anchoring on the current year
 * keeps the live balance correct and immune to minor historical
 * reconciliation noise in earlier years.
 *
 * IMPORTANT: Every transaction in the period affects the compte courant
 * balance. No exclusions - all debits reduce the balance, all credits
 * increase it.
 */
export async function computeCurrentBalance(accountId?: number): Promise<{
  balance: number;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  startDate: string | null;
  fiscalYearLabel: string | null;
}> {
  const db = await getDb();

  // Get the LATEST fiscal year - its opening_balance is the carry-forward
  // closing balance from the prior year.
  const fyRows = await db.select<{
    id: number; opening_balance: number | null; label: string;
    start_year: number; start_month: number;
  }[]>(
    `SELECT id, opening_balance, label, start_year, start_month
     FROM fiscal_years
     ${accountId !== undefined ? 'WHERE account_id = ?' : ''}
     ORDER BY start_year DESC, start_month DESC
     LIMIT 1`,
    accountId !== undefined ? [accountId] : []
  );

  if (fyRows.length === 0) {
    return { balance: 0, openingBalance: 0, totalCredits: 0, totalDebits: 0, transactionCount: 0, startDate: null, fiscalYearLabel: null };
  }

  const fy = fyRows[0];
  const openingBalance = fy.opening_balance ?? 0;

  // First day of the fiscal year (e.g. 2025-09-01)
  const fyStart = `${fy.start_year}-${String(fy.start_month).padStart(2, '0')}-01`;

  // Sum credits and debits from the fiscal year start onward - no exclusions
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
     WHERE date >= ?${accountId !== undefined ? ' AND account_id = ?' : ''}`,
    accountId !== undefined ? [fyStart, accountId] : [fyStart]
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
