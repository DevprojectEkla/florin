import { getDb } from './client';
import type { Transaction } from '../types';

export interface TransactionWithCategory extends Transaction {
  category_label: string | null;
  category_slug: string | null;
  category_color: string | null;
  category_icon: string | null;
  category_type: string | null;
}

export async function getTransactions(
  fiscalYearId: number | null,
  opts?: { month?: number; year?: number; categoryId?: number; unclassifiedOnly?: boolean }
): Promise<TransactionWithCategory[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (fiscalYearId !== null) {
    conditions.push('t.fiscal_year_id = ?');
    params.push(fiscalYearId);
  }

  if (opts?.month && opts?.year) {
    conditions.push("strftime('%m', t.date) = ?");
    conditions.push("strftime('%Y', t.date) = ?");
    params.push(String(opts.month).padStart(2, '0'));
    params.push(String(opts.year));
  }

  if (opts?.categoryId) {
    conditions.push('t.category_id = ?');
    params.push(opts.categoryId);
  }

  if (opts?.unclassifiedOnly) {
    conditions.push('t.category_id IS NULL');
  }

  return db.select<TransactionWithCategory[]>(
    `SELECT t.*,
            c.label as category_label,
            c.slug as category_slug,
            c.color as category_color,
            c.icon as category_icon,
            c.type as category_type
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
     ORDER BY t.date DESC, t.id DESC`,
    params
  );
}

export async function getTransactionCount(fiscalYearId: number | null): Promise<number> {
  const db = await getDb();
  if (fiscalYearId === null) {
    const rows = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM transactions');
    return rows[0]?.n ?? 0;
  }
  const rows = await db.select<{ n: number }[]>(
    'SELECT COUNT(*) as n FROM transactions WHERE fiscal_year_id = ?',
    [fiscalYearId]
  );
  return rows[0]?.n ?? 0;
}

export async function getUnclassifiedCount(fiscalYearId: number | null): Promise<number> {
  const db = await getDb();
  if (fiscalYearId === null) {
    const rows = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM transactions WHERE category_id IS NULL');
    return rows[0]?.n ?? 0;
  }
  const rows = await db.select<{ n: number }[]>(
    'SELECT COUNT(*) as n FROM transactions WHERE fiscal_year_id = ? AND category_id IS NULL',
    [fiscalYearId]
  );
  return rows[0]?.n ?? 0;
}

export async function updateTransactionCategory(
  id: number,
  categoryId: number | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE transactions SET category_id = ?, is_reviewed = 1 WHERE id = ?',
    [categoryId, id]
  );
}

// ─── Monthly aggregations ────────────────────────────────────────────────────

export interface MonthlyAggregate {
  year: number;
  month: number;
  total_debit: number;
  total_credit: number;
  net: number;
}

export async function getMonthlyAggregates(fiscalYearId: number | null): Promise<MonthlyAggregate[]> {
  const db = await getDb();
  const where = fiscalYearId !== null ? 'WHERE fiscal_year_id = ?' : '';
  const params = fiscalYearId !== null ? [fiscalYearId] : [];
  return db.select<MonthlyAggregate[]>(
    `SELECT
       CAST(strftime('%Y', date) AS INTEGER) as year,
       CAST(strftime('%m', date) AS INTEGER) as month,
       COALESCE(SUM(debit), 0) as total_debit,
       COALESCE(SUM(credit), 0) as total_credit,
       COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as net
     FROM transactions
     ${where}
     GROUP BY year, month
     ORDER BY year, month`,
    params
  );
}

export interface CategoryAggregate {
  category_id: number | null;
  category_label: string | null;
  category_color: string | null;
  category_icon: string | null;
  category_type: string | null;
  total: number;
}

export async function getCategoryAggregates(
  fiscalYearId: number | null,
  year?: number,
  month?: number
): Promise<CategoryAggregate[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (fiscalYearId !== null) {
    conditions.push('t.fiscal_year_id = ?');
    params.push(fiscalYearId);
  }

  if (month && year) {
    conditions.push("CAST(strftime('%m', t.date) AS INTEGER) = ?");
    conditions.push("CAST(strftime('%Y', t.date) AS INTEGER) = ?");
    params.push(month);
    params.push(year);
  }

  return db.select<CategoryAggregate[]>(
    `SELECT
       t.category_id,
       c.label as category_label,
       c.color as category_color,
       c.icon as category_icon,
       c.type as category_type,
       COALESCE(SUM(t.debit), 0) - COALESCE(SUM(t.credit), 0) as total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
     GROUP BY t.category_id
     HAVING total != 0
     ORDER BY total DESC`,
    params
  );
}
