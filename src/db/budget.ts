import { getDb } from './client';
import type { BudgetLine } from '../types';

export interface BudgetLineWithCategory extends BudgetLine {
  category_label: string;
  category_icon: string | null;
  category_color: string | null;
  category_type: string;
}

export async function getBudgetLines(fiscalYearId: number): Promise<BudgetLineWithCategory[]> {
  const db = await getDb();
  return db.select<BudgetLineWithCategory[]>(
    `SELECT bl.*, c.label as category_label, c.icon as category_icon,
            c.color as category_color, c.type as category_type
     FROM budget_lines bl
     JOIN categories c ON c.id = bl.category_id
     WHERE bl.fiscal_year_id = ?
     ORDER BY c.sort_order ASC`,
    [fiscalYearId]
  );
}

export async function upsertBudgetLine(
  fiscalYearId: number,
  categoryId: number,
  monthlyAmount: number,
  minAmount?: number | null,
  maxAmount?: number | null,
): Promise<void> {
  const db = await getDb();
  if (monthlyAmount <= 0) {
    await db.execute(
      'DELETE FROM budget_lines WHERE fiscal_year_id = ? AND category_id = ?',
      [fiscalYearId, categoryId]
    );
  } else {
    await db.execute(
      `INSERT INTO budget_lines (fiscal_year_id, category_id, monthly_amount, min_amount, max_amount)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(fiscal_year_id, category_id) DO UPDATE SET
         monthly_amount = excluded.monthly_amount,
         min_amount     = excluded.min_amount,
         max_amount     = excluded.max_amount`,
      [fiscalYearId, categoryId, monthlyAmount, minAmount ?? null, maxAmount ?? null]
    );
  }
}

export async function setBudgetBatch(
  fiscalYearId: number,
  lines: { categoryId: number; amount: number; minAmount?: number | null; maxAmount?: number | null }[]
): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM budget_lines WHERE fiscal_year_id = ?', [fiscalYearId]);
  for (const line of lines) {
    if (line.amount > 0) {
      await db.execute(
        `INSERT INTO budget_lines (fiscal_year_id, category_id, monthly_amount, min_amount, max_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [fiscalYearId, line.categoryId, line.amount, line.minAmount ?? null, line.maxAmount ?? null]
      );
    }
  }
}

// ─── Budget vs Actual comparison ─────────────────────────────────────────────

export interface BudgetComparison {
  category_id: number;
  category_label: string;
  category_icon: string | null;
  category_color: string | null;
  budgeted: number;
  min_amount: number | null;
  max_amount: number | null;
  actual: number;
  delta: number;
  percentage: number;
}

export async function getBudgetComparison(
  fiscalYearId: number,
  year: number,
  month: number
): Promise<BudgetComparison[]> {
  const db = await getDb();

  const budgetLines = await getBudgetLines(fiscalYearId);
  if (budgetLines.length === 0) return [];

  const actuals = await db.select<{ category_id: number; total: number }[]>(
    `SELECT category_id, COALESCE(SUM(debit), 0) as total
     FROM transactions
     WHERE fiscal_year_id = ?
       AND CAST(strftime('%Y', date) AS INTEGER) = ?
       AND CAST(strftime('%m', date) AS INTEGER) = ?
       AND category_id IS NOT NULL
     GROUP BY category_id`,
    [fiscalYearId, year, month]
  );

  const actualMap = new Map(actuals.map((a) => [a.category_id, a.total]));

  return budgetLines.map((bl) => {
    const actual = actualMap.get(bl.category_id) ?? 0;
    return {
      category_id: bl.category_id,
      category_label: bl.category_label,
      category_icon: bl.category_icon,
      category_color: bl.category_color,
      budgeted: bl.monthly_amount,
      min_amount: bl.min_amount,
      max_amount: bl.max_amount,
      actual,
      delta: actual - bl.monthly_amount,
      percentage: bl.monthly_amount > 0 ? (actual / bl.monthly_amount) * 100 : 0,
    };
  });
}

export interface BudgetSummary {
  total_budgeted: number;
  total_actual: number;
  total_delta: number;
  percentage: number;
  month_income: number;       // total credits (income) for the month
  available: number;          // month_income - total_actual (real remaining)
  count_ok: number;           // categories under min
  count_warning: number;      // categories between min and max
  count_over: number;         // categories over max (or over budgeted if no range)
}

export async function getBudgetSummary(
  fiscalYearId: number,
  year: number,
  month: number
): Promise<BudgetSummary> {
  const db = await getDb();
  const comparisons = await getBudgetComparison(fiscalYearId, year, month);
  const total_budgeted = comparisons.reduce((s, c) => s + c.budgeted, 0);
  const total_actual   = comparisons.reduce((s, c) => s + c.actual, 0);

  // Total income attributed to this month.
  // Uses attributed_month tag when set (either manually or pre-populated at import).
  // When no tag is set, income is counted on its actual transaction date.
  // The day-based heuristic has been removed — all salary attributions are
  // managed explicitly via the attributed_month column.
  const incomeRows = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(credit), 0) as total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE c.type = 'income'
       AND (
         -- Has an explicit attributed_month tag pointing to this month
         (t.attributed_month = printf('%04d-%02d', ?, ?))
         OR
         -- No tag: use actual transaction date
         (t.attributed_month IS NULL
           AND CAST(strftime('%Y', t.date) AS INTEGER) = ?
           AND CAST(strftime('%m', t.date) AS INTEGER) = ?)
       )`,
    [year, month, year, month]
  );
  const month_income = incomeRows[0]?.total ?? 0;

  // Per-category status counts
  let count_ok = 0, count_warning = 0, count_over = 0;
  for (const c of comparisons) {
    if (c.max_amount != null && c.min_amount != null) {
      if (c.actual > c.max_amount)       count_over++;
      else if (c.actual >= c.min_amount) count_warning++;
      else                               count_ok++;
    } else {
      if (c.actual > c.budgeted * 1.1)   count_over++;
      else if (c.actual > c.budgeted * 0.9) count_warning++;
      else                               count_ok++;
    }
  }

  return {
    total_budgeted,
    total_actual,
    total_delta: total_actual - total_budgeted,
    percentage: total_budgeted > 0 ? (total_actual / total_budgeted) * 100 : 0,
    month_income,
    available: month_income - total_actual,
    count_ok,
    count_warning,
    count_over,
  };
}

// ─── Pre-fill from historical averages ───────────────────────────────────────

export async function computeAveragesFromHistory(
  fiscalYearId: number
): Promise<{ categoryId: number; average: number }[]> {
  const db = await getDb();

  const months = await db.select<{ n: number }[]>(
    `SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n
     FROM transactions WHERE fiscal_year_id = ?`,
    [fiscalYearId]
  );
  const monthCount = Math.max(months[0]?.n ?? 1, 1);

  const totals = await db.select<{ category_id: number; total: number }[]>(
    `SELECT t.category_id, COALESCE(SUM(t.debit), 0) as total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.fiscal_year_id = ?
       AND t.debit IS NOT NULL
       AND c.type IN ('fixed', 'variable')
       AND t.category_id IS NOT NULL
     GROUP BY t.category_id`,
    [fiscalYearId]
  );

  return totals.map((row) => ({
    categoryId: row.category_id,
    average: Math.round(row.total / monthCount),
  }));
}
