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
  monthlyAmount: number
): Promise<void> {
  const db = await getDb();
  if (monthlyAmount <= 0) {
    // Remove the line if amount is zero
    await db.execute(
      'DELETE FROM budget_lines WHERE fiscal_year_id = ? AND category_id = ?',
      [fiscalYearId, categoryId]
    );
  } else {
    await db.execute(
      `INSERT INTO budget_lines (fiscal_year_id, category_id, monthly_amount)
       VALUES (?, ?, ?)
       ON CONFLICT(fiscal_year_id, category_id) DO UPDATE SET monthly_amount = ?`,
      [fiscalYearId, categoryId, monthlyAmount, monthlyAmount]
    );
  }
}

export async function setBudgetBatch(
  fiscalYearId: number,
  lines: { categoryId: number; amount: number }[]
): Promise<void> {
  const db = await getDb();
  // Delete existing for this FY, then insert fresh
  await db.execute('DELETE FROM budget_lines WHERE fiscal_year_id = ?', [fiscalYearId]);
  for (const line of lines) {
    if (line.amount > 0) {
      await db.execute(
        'INSERT INTO budget_lines (fiscal_year_id, category_id, monthly_amount) VALUES (?, ?, ?)',
        [fiscalYearId, line.categoryId, line.amount]
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
  actual: number;
  delta: number;       // negative = under budget (good), positive = over budget
  percentage: number;  // actual / budgeted * 100
}

export async function getBudgetComparison(
  fiscalYearId: number,
  year: number,
  month: number
): Promise<BudgetComparison[]> {
  const db = await getDb();

  // Get budget lines
  const budgetLines = await getBudgetLines(fiscalYearId);
  if (budgetLines.length === 0) return [];

  // Get actual spending per category for this month
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
}

export async function getBudgetSummary(
  fiscalYearId: number,
  year: number,
  month: number
): Promise<BudgetSummary> {
  const comparisons = await getBudgetComparison(fiscalYearId, year, month);
  const total_budgeted = comparisons.reduce((s, c) => s + c.budgeted, 0);
  const total_actual = comparisons.reduce((s, c) => s + c.actual, 0);
  return {
    total_budgeted,
    total_actual,
    total_delta: total_actual - total_budgeted,
    percentage: total_budgeted > 0 ? (total_actual / total_budgeted) * 100 : 0,
  };
}

// ─── Pre-fill from historical averages ───────────────────────────────────────

/**
 * Compute average monthly spending per expense category from a fiscal year's
 * actual transaction data. Used to pre-fill budget targets based on real history.
 */
export async function computeAveragesFromHistory(
  fiscalYearId: number
): Promise<{ categoryId: number; average: number }[]> {
  const db = await getDb();

  // Count distinct months with transaction data
  const months = await db.select<{ n: number }[]>(
    `SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n
     FROM transactions WHERE fiscal_year_id = ?`,
    [fiscalYearId]
  );
  const monthCount = Math.max(months[0]?.n ?? 1, 1);

  // Total spending per expense category (debits only)
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
