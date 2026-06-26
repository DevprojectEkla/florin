import { getDb } from './client';
import type { Account, FiscalYear } from '../types';

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

// ─── Fiscal Years ────────────────────────────────────────────────────────────

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

// ─── Onboarding check ────────────────────────────────────────────────────────

export async function isOnboardingComplete(): Promise<boolean> {
  const account = await getFirstAccount();
  if (!account) return false;
  const fy = await getActiveFiscalYear(account.id);
  return fy !== null;
}
