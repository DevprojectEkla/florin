import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useActiveCategories } from '../hooks/useCategories';
import { useBudgetLines, useBudgetComparison, useBudgetSummary, useSetBudgetBatch } from '../hooks/useBudget';
import type { Category } from '../types';

type Tab = 'comparison' | 'setup';

export default function Budget() {
  const { t } = useTranslation();
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();
  const [tab, setTab] = useState<Tab>('comparison');

  // Month picker — default to current month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());

  if (!fyId || !fiscalYear) {
    return (
      <div className="p-6">
        <div className="card text-slate-400">{t('budget.no_fiscal_year')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.budget')}</h1>
          <p className="text-slate-400 text-sm">{fiscalYear.label}</p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'comparison' ? 'bg-florin-500/20 text-florin-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setTab('comparison')}
          >
            {t('budget.tab_comparison')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'setup' ? 'bg-florin-500/20 text-florin-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setTab('setup')}
          >
            {t('budget.tab_setup')}
          </button>
        </div>
      </div>

      {tab === 'comparison' && (
        <ComparisonView
          fyId={fyId}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onMonthChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        />
      )}
      {tab === 'setup' && <SetupView fyId={fyId} />}
    </div>
  );
}

// ─── Comparison View ─────────────────────────────────────────────────────────

function ComparisonView({ fyId, selectedYear, selectedMonth, onMonthChange }: {
  fyId: number; selectedYear: number; selectedMonth: number;
  onMonthChange: (y: number, m: number) => void;
}) {
  const { t } = useTranslation();
  const { data: comparisons = [] } = useBudgetComparison(fyId, selectedYear, selectedMonth);
  const { data: summary } = useBudgetSummary(fyId, selectedYear, selectedMonth);

  function prevMonth() {
    if (selectedMonth === 1) onMonthChange(selectedYear - 1, 12);
    else onMonthChange(selectedYear, selectedMonth - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) onMonthChange(selectedYear + 1, 1);
    else onMonthChange(selectedYear, selectedMonth + 1);
  }

  return (
    <>
      {/* Month picker */}
      <div className="flex items-center justify-center gap-4">
        <button className="btn-ghost text-sm" onClick={prevMonth}>←</button>
        <span className="text-slate-200 font-medium">
          {t(`months.${selectedMonth}`)} {selectedYear}
        </span>
        <button className="btn-ghost text-sm" onClick={nextMonth}>→</button>
      </div>

      {/* Summary card */}
      {summary && summary.total_budgeted > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-400">{t('budget.total_budgeted')}</span>
              <div className="text-lg font-bold text-slate-100">{summary.total_budgeted.toFixed(0)} €</div>
            </div>
            <div>
              <span className="text-sm text-slate-400">{t('budget.total_spent')}</span>
              <div className="text-lg font-bold text-slate-100">{summary.total_actual.toFixed(0)} €</div>
            </div>
            <div>
              <span className="text-sm text-slate-400">{t('budget.remaining')}</span>
              <div className={`text-lg font-bold ${summary.total_delta <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.total_delta <= 0 ? '' : '+'}{summary.total_delta.toFixed(0)} €
              </div>
            </div>
            <div>
              <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    summary.percentage <= 90 ? 'bg-green-500' :
                    summary.percentage <= 110 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(summary.percentage, 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 mt-0.5">{summary.percentage.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Per-category comparison */}
      {comparisons.length === 0 ? (
        <div className="card text-slate-400 text-center py-8">
          {t('budget.no_budget_set')}
        </div>
      ) : (
        <div className="space-y-2">
          {comparisons.map((c) => (
            <div key={c.category_id} className="card flex items-center gap-4 py-3">
              {/* Icon + label */}
              <span className="text-lg w-7 text-center">{c.category_icon ?? '🔖'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-200 truncate">{c.category_label}</span>
                  <span className={`text-xs font-mono ${
                    c.delta <= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {c.actual.toFixed(0)} / {c.budgeted.toFixed(0)} €
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.percentage <= 90 ? 'bg-green-500' :
                      c.percentage <= 110 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(c.percentage, 100)}%` }}
                  />
                </div>
              </div>
              {/* Percentage */}
              <span className={`text-xs font-medium w-12 text-right ${
                c.percentage <= 90 ? 'text-green-400' :
                c.percentage <= 110 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {c.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Setup View ──────────────────────────────────────────────────────────────

function SetupView({ fyId }: { fyId: number }) {
  const { t } = useTranslation();
  const { data: categories = [] } = useActiveCategories();
  const { data: existingLines = [] } = useBudgetLines(fyId);
  const setBatchMut = useSetBudgetBatch();

  // Only show expense categories (fixed + variable)
  const expenseCategories = categories.filter(
    (c) => c.type === 'fixed' || c.type === 'variable'
  );

  // Build initial form state from existing lines
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync amounts when data first loads (not on every render)
  if (!initialized && existingLines.length > 0) {
    const map: Record<number, string> = {};
    for (const cat of expenseCategories) {
      const line = existingLines.find((l) => l.category_id === cat.id);
      map[cat.id] = line ? String(line.monthly_amount) : '';
    }
    setAmounts(map);
    setInitialized(true);
  }

  const total = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  async function handleSave() {
    const lines = Object.entries(amounts)
      .map(([catId, amt]) => ({ categoryId: parseInt(catId), amount: parseFloat(amt) || 0 }))
      .filter((l) => l.amount > 0);

    await setBatchMut.mutateAsync({ fiscalYearId: fyId, lines });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-400">{t('budget.setup_title')}</h2>
          <div className="flex items-center gap-3">
            {saved && <span className="text-green-400 text-xs">✓ {t('budget.saved')}</span>}
            <span className="text-sm text-slate-300 font-mono">
              {t('budget.total')}: <span className="text-florin-400 font-bold">{total.toFixed(0)} €</span> /mois
            </span>
          </div>
        </div>

        <div className="space-y-1">
          {/* Fixed expenses */}
          <SectionHeader label={t('category.types.fixed')} />
          {expenseCategories.filter((c) => c.type === 'fixed').map((cat) => (
            <BudgetRow
              key={cat.id}
              category={cat}
              value={amounts[cat.id] ?? ''}
              onChange={(val) => setAmounts((prev) => ({ ...prev, [cat.id]: val }))}
            />
          ))}

          {/* Variable expenses */}
          <SectionHeader label={t('category.types.variable')} />
          {expenseCategories.filter((c) => c.type === 'variable').map((cat) => (
            <BudgetRow
              key={cat.id}
              category={cat}
              value={amounts[cat.id] ?? ''}
              onChange={(val) => setAmounts((prev) => ({ ...prev, [cat.id]: val }))}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={setBatchMut.isPending}
          >
            {setBatchMut.isPending ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function BudgetRow({ category, value, onChange }: {
  category: Category; value: string; onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-base w-6 text-center">{category.icon ?? '🔖'}</span>
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: category.color ?? '#64748b' }}
      />
      <span className="flex-1 text-sm text-slate-200">{category.label}</span>
      <div className="w-28 flex items-center gap-1">
        <input
          className="input text-right text-sm py-1 px-2"
          type="number"
          step="10"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
        <span className="text-xs text-slate-500">€</span>
      </div>
    </div>
  );
}
