// ─── Domain types ────────────────────────────────────────────────────────────

export type CategoryType = 'income' | 'fixed' | 'variable' | 'savings' | 'transfer' | 'capital';

export interface Category {
  id: number;
  slug: string;
  label: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Account {
  id: number;
  name: string;
  bank_name: string;
  account_number: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface FiscalYear {
  id: number;
  account_id: number;
  label: string;
  start_year: number;
  start_month: number;
  opening_balance: number | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  fiscal_year_id: number;
  import_batch_id: number | null;
  date: string;
  label: string;
  label_clean: string | null;
  debit: number | null;
  credit: number | null;
  category_id: number | null;
  is_out_of_budget: boolean;
  notes: string | null;
  is_reviewed: boolean;
  dedup_hash: string;
  attributed_month: string | null; // YYYY-MM override for budget income attribution
  created_at: string;
  // joined
  category?: Category;
}

export interface ImportBatch {
  id: number;
  account_id: number;
  fiscal_year_id: number;
  filename: string;
  account_number_raw: string | null;
  balance_at_import: number | null;
  period_from: string | null;
  period_to: string | null;
  rows_in_file: number | null;
  rows_imported: number | null;
  rows_skipped: number | null;
  rows_conflicted: number | null;
  imported_at: string;
}

export interface MonthlyBalance {
  id: number;
  account_id: number;
  fiscal_year_id: number;
  year: number;
  month: number;
  closing_balance: number;
  is_locked: boolean;
}

export interface BudgetLine {
  id: number;
  fiscal_year_id: number;
  category_id: number;
  monthly_amount: number;
  min_amount: number | null;
  max_amount: number | null;
  category?: Category;
}

export interface AppSettings {
  fiscal_year_start_month: number;
  app_version: string;
  default_language: string;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export interface MonthlySummary {
  year: number;
  month: number;
  total_debit: number;
  total_credit: number;
  net: number;
  by_category: { category_id: number; label: string; type: CategoryType; total: number }[];
}
