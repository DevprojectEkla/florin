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

export async function updateTransactionNotes(
  id: number,
  notes: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE transactions SET notes = ? WHERE id = ?',
    [notes, id]
  );
}

export async function updateTransactionAttributedMonth(
  id: number,
  attributedMonth: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE transactions SET attributed_month = ? WHERE id = ?',
    [attributedMonth, id]
  );
}

export async function updateTransactionLabelClean(
  id: number,
  labelClean: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE transactions SET label_clean = ? WHERE id = ?',
    [labelClean, id]
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

export interface ManualTransactionInput {
  accountId: number;
  fiscalYearId: number;
  date: string;
  label: string;         // original label (stored in `label` column)
  txTypeLabel?: string | null;  // e.g. "CB", "VIR" (prepended to label_clean)
  debit: number | null;
  credit: number | null;
  categoryId: number | null;
  notes?: string | null;
}

export async function insertManualTransaction(input: ManualTransactionInput): Promise<void> {
  const db = await getDb();
  // Build a dedup hash that won't collide with imported ones
  // Prefix "manual:" makes it inherently distinct from CA-imported hashes
  const amount = input.debit ?? input.credit ?? 0;
  const baseHash = `manual:${input.date}|${input.label.trim()}|${amount.toFixed(2)}`;

  // Handle same-day same-amount manual entries (same logic as import)
  const existing = await db.select<{ dedup_hash: string }[]>(
    `SELECT dedup_hash FROM transactions WHERE dedup_hash LIKE ? ORDER BY id`,
    [`${baseHash}%`]
  );
  const occurrence = existing.length + 1;
  const hash = occurrence > 1 ? `${baseHash}#${occurrence}` : baseHash;

  // label_clean uses the 3-space gap format that splitLabel's gapMatch recognises:
  // "TYPE   detail" → splitLabel returns { type: "TYPE", detail: "detail" }
  // If no txTypeLabel is provided, label_clean is null (UI falls back to label column).
  const labelClean = input.txTypeLabel?.trim()
    ? `${input.txTypeLabel.trim().toUpperCase()}   ${input.label.trim()}`
    : null;

  await db.execute(
    `INSERT INTO transactions
      (account_id, fiscal_year_id, import_batch_id, date, label, label_clean,
       debit, credit, category_id, is_reviewed, notes, dedup_hash)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.accountId,
      input.fiscalYearId,
      input.date,
      input.label.trim(),
      labelClean,
      input.debit,
      input.credit,
      input.categoryId,
      0,
      input.notes ?? null,
      hash,
    ]
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

  // For income transactions with an attributed_month override, use that month
  // instead of the transaction date. Debits always use the real date.
  return db.select<MonthlyAggregate[]>(
    `SELECT
       CAST(
         CASE WHEN credit IS NOT NULL AND attributed_month IS NOT NULL
           THEN substr(attributed_month, 1, 4)
           ELSE strftime('%Y', date)
         END
       AS INTEGER) as year,
       CAST(
         CASE WHEN credit IS NOT NULL AND attributed_month IS NOT NULL
           THEN substr(attributed_month, 6, 2)
           ELSE strftime('%m', date)
         END
       AS INTEGER) as month,
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
  category_slug: string | null;
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
    // For credits with attributed_month tag, match on that month.
    // For everything else (debits + untagged credits), use the real date.
    conditions.push(`(
      (t.credit IS NOT NULL AND t.attributed_month IS NOT NULL
        AND CAST(substr(t.attributed_month, 6, 2) AS INTEGER) = ?
        AND CAST(substr(t.attributed_month, 1, 4) AS INTEGER) = ?)
      OR
      (NOT (t.credit IS NOT NULL AND t.attributed_month IS NOT NULL)
        AND CAST(strftime('%m', t.date) AS INTEGER) = ?
        AND CAST(strftime('%Y', t.date) AS INTEGER) = ?)
    )`);
    params.push(month, year, month, year);
  }

  return db.select<CategoryAggregate[]>(
    `SELECT
       t.category_id,
       c.label as category_label,
       c.slug as category_slug,
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
