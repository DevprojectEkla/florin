import { getDb } from './client';
import type { Account, FiscalYear } from '../types';
import { normalizeAccountNumber, sameAccountNumber } from '../lib/accounts';

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.select<Account[]>(
    'SELECT * FROM accounts WHERE is_active = 1 ORDER BY id'
  );
}

export async function getFirstAccount(): Promise<Account | null> {
  const db = await getDb();
  const rows = await db.select<Account[]>(
    'SELECT * FROM accounts WHERE is_active = 1 ORDER BY id LIMIT 1'
  );
  return rows[0] ?? null;
}

export interface CreateAccountInput {
  name: string;
  bank_name: string;
  account_number?: string;
}

export async function createAccount(input: CreateAccountInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO accounts (name, bank_name, account_number)
     VALUES (?, ?, ?)`,
    [input.name, input.bank_name, input.account_number ?? null]
  );
  return result.lastInsertId as number;
}

export interface UpdateAccountInput {
  name: string;
  bank_name: string;
  account_number: string | null;
}

export async function updateAccount(id: number, input: UpdateAccountInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE accounts SET name = ?, bank_name = ?, account_number = ? WHERE id = ?',
    [input.name, input.bank_name, input.account_number, id]
  );
}

/** Find an active account whose number matches `raw` (leading zeros ignored). */
export async function findAccountByNumber(raw: string | null | undefined): Promise<Account | null> {
  if (normalizeAccountNumber(raw) === '') return null;
  const accounts = await getAccounts();
  return accounts.find((a) => sameAccountNumber(a.account_number, raw)) ?? null;
}

/** Id of the first-created account; it keeps the legacy (un-prefixed) dedup hashes. */
export async function getLegacyAccountId(): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select<{ id: number | null }[]>('SELECT MIN(id) as id FROM accounts');
  return rows[0]?.id ?? null;
}

// ─── Fiscal Years ────────────────────────────────────────────────────────────

/**
 * Administrative action: overwrite a fiscal year's opening balance.
 * The current bank balance is anchored on this value, so callers must ask
 * for explicit confirmation first.
 */
export async function setFiscalYearOpeningBalance(
  fiscalYearId: number,
  openingBalance: number | null
): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE fiscal_years SET opening_balance = ? WHERE id = ?', [
    openingBalance,
    fiscalYearId,
  ]);
}

export async function getFiscalYears(accountId: number): Promise<FiscalYear[]> {
  const db = await getDb();
  return db.select<FiscalYear[]>(
    'SELECT * FROM fiscal_years WHERE account_id = ? ORDER BY start_year DESC, start_month DESC',
    [accountId]
  );
}

export async function getActiveFiscalYear(accountId: number): Promise<FiscalYear | null> {
  const db = await getDb();
  const rows = await db.select<FiscalYear[]>(
    'SELECT * FROM fiscal_years WHERE account_id = ? ORDER BY start_year DESC, start_month DESC LIMIT 1',
    [accountId]
  );
  return rows[0] ?? null;
}

export interface CreateFiscalYearInput {
  account_id: number;
  label: string;
  start_year: number;
  start_month: number;
  opening_balance?: number;
}

export async function createFiscalYear(input: CreateFiscalYearInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO fiscal_years (account_id, label, start_year, start_month, opening_balance)
     VALUES (?, ?, ?, ?, ?)`,
    [input.account_id, input.label, input.start_year, input.start_month, input.opening_balance ?? null]
  );
  return result.lastInsertId as number;
}

/**
 * Given a transaction date, return the fiscal year it belongs to, creating a
 * new fiscal year on the fly if none exists yet. The start month is inherited
 * from the account's existing fiscal years (defaults to 9 = September).
 *
 * A fiscal year "YYYY-(YYYY+1)" starting in month M covers dates from
 * YYYY-M-01 up to (YYYY+1)-(M-1)-end.
 */
export async function resolveFiscalYearForDate(
  accountId: number,
  isoDate: string // 'YYYY-MM-DD'
): Promise<FiscalYear> {
  const db = await getDb();

  const [y, m] = isoDate.split('-').map(Number);

  // Determine the start month from an existing fiscal year, default to September
  const existing = await db.select<FiscalYear[]>(
    'SELECT * FROM fiscal_years WHERE account_id = ? ORDER BY start_year DESC LIMIT 1',
    [accountId]
  );
  const startMonth = existing[0]?.start_month ?? 9;

  // The fiscal year's starting calendar year for this date:
  // if the month is >= startMonth, the FY started this year; otherwise it started last year.
  const fyStartYear = m >= startMonth ? y : y - 1;

  // Look for an existing fiscal year matching that start
  const match = await db.select<FiscalYear[]>(
    'SELECT * FROM fiscal_years WHERE account_id = ? AND start_year = ? AND start_month = ?',
    [accountId, fyStartYear, startMonth]
  );
  if (match.length > 0) return match[0];

  // None exists — create it. Carry forward the previous year's closing balance
  // is left to the balance logic; opening_balance stays null (unknown) here.
  const label = `${fyStartYear}-${fyStartYear + 1}`;
  const id = await createFiscalYear({
    account_id: accountId,
    label,
    start_year: fyStartYear,
    start_month: startMonth,
  });

  // Carry the budget forward from the most recent prior fiscal year so the
  // new year isn't blank. Uses the immediately preceding FY (by start date).
  const prior = await db.select<{ id: number }[]>(
    `SELECT id FROM fiscal_years
     WHERE account_id = ?
       AND (start_year < ? OR (start_year = ? AND start_month < ?))
     ORDER BY start_year DESC, start_month DESC
     LIMIT 1`,
    [accountId, fyStartYear, fyStartYear, startMonth]
  );
  if (prior.length > 0) {
    await db.execute(
      `INSERT INTO budget_lines (fiscal_year_id, category_id, monthly_amount, min_amount, max_amount)
       SELECT ?, category_id, monthly_amount, min_amount, max_amount
       FROM budget_lines WHERE fiscal_year_id = ?`,
      [id, prior[0].id]
    );
  }

  const created = await db.select<FiscalYear[]>(
    'SELECT * FROM fiscal_years WHERE id = ?',
    [id]
  );
  return created[0];
}

// ─── Onboarding check ────────────────────────────────────────────────────────

export async function isOnboardingComplete(): Promise<boolean> {
  const account = await getFirstAccount();
  if (!account) return false;
  const fy = await getActiveFiscalYear(account.id);
  return fy !== null;
}
