import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useViewMonth } from '../store/MonthContext';
import { useActiveCategories } from '../hooks/useCategories';
import { useBudgetLines, useBudgetComparison, useBudgetSummary, useSetBudgetBatch, useComputeAverages } from '../hooks/useBudget';
import type { Category } from '../types';
import type { BudgetComparison } from '../db/budget';

type Tab = 'comparison' | 'setup';

interface AmountEntry { target: string; min: string; max: string; }

export default function Budget() {
  const { t } = useTranslation();
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();
  const { viewYear: selectedYear, viewMonth: selectedMonth, setViewMonth } = useViewMonth();
  const [tab, setTab] = useState<Tab>('comparison');

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
          onMonthChange={(y, m) => setViewMonth(y, m)}
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
  const { allFiscalYears } = useFiscalYear();

  // Derive the correct fiscal year for the currently displayed month.
  const effectiveFyId = (() => {
    const d = new Date(selectedYear, selectedMonth - 1);
    const match = allFiscalYears.find((fy) => {
      const fyStart = new Date(fy.start_year, fy.start_month - 1);
      let endMonth = fy.start_month - 1;
      let endYear  = fy.start_year + 1;
      if (endMonth < 1) { endMonth = 12; endYear--; }
      const fyEnd = new Date(endYear, endMonth - 1);
      return d >= fyStart && d <= fyEnd;
    });
    return match?.id ?? fyId;
  })();

  const { data: comparisons = [] } = useBudgetComparison(effectiveFyId, selectedYear, selectedMonth);
  const { data: summary } = useBudgetSummary(effectiveFyId, selectedYear, selectedMonth);

  function prevMonth() {
    if (selectedMonth === 1) onMonthChange(selectedYear - 1, 12);
    else onMonthChange(selectedYear, selectedMonth - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) onMonthChange(selectedYear + 1, 1);
    else onMonthChange(selectedYear, selectedMonth + 1);
  }

  // ── Sort categories by urgency: over → warning → ok ──
  const sorted = [...comparisons].sort((a, b) => {
    const rank = (c: BudgetComparison) => {
      if (c.max_amount != null && c.min_amount != null) {
        if (c.actual > c.max_amount) return 0;
        if (c.actual >= c.min_amount) return 1;
        return 2;
      }
      if (c.actual > c.budgeted * 1.1) return 0;
      if (c.actual > c.budgeted * 0.9) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  // ── Global health status ──
  const globalStatus = (() => {
    if (!summary) return null;
    if (summary.count_over > 0) return 'danger';
    if (summary.count_warning > 0) return 'warning';
    return 'ok';
  })();

  return (
    <>
      {/* Month picker */}
      <div className="flex items-center justify-center gap-4">
        <button className="btn-ghost text-sm" onClick={prevMonth}>←</button>
        <span className="text-slate-200 font-medium w-44 text-center inline-block">
          {t(`months.${selectedMonth}`)} {selectedYear}
        </span>
        <button className="btn-ghost text-sm" onClick={nextMonth}>→</button>
      </div>

      {/* ── Health bar ── */}
      {summary && summary.total_budgeted > 0 && (
        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
          globalStatus === 'danger'  ? 'bg-red-500/10 border-red-500/30' :
          globalStatus === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                                       'bg-green-500/10 border-green-500/30'
        }`}>
          {/* Status icon + label */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {globalStatus === 'danger' ? '🔴' : globalStatus === 'warning' ? '🟡' : '🟢'}
            </span>
            <div>
              <div className={`text-sm font-semibold ${
                globalStatus === 'danger'  ? 'text-red-300' :
                globalStatus === 'warning' ? 'text-amber-300' : 'text-green-300'
              }`}>
                {globalStatus === 'danger'  ? 'Dépassements ce mois' :
                 globalStatus === 'warning' ? 'Quelques tensions' : 'Dans les clous'}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {summary.count_over > 0 && (
                  <span className="text-xs text-red-400">{summary.count_over} dépassé{summary.count_over > 1 ? 's' : ''}</span>
                )}
                {summary.count_warning > 0 && (
                  <span className="text-xs text-amber-400">{summary.count_warning} en zone</span>
                )}
                {summary.count_ok > 0 && (
                  <span className="text-xs text-green-400">{summary.count_ok} OK</span>
                )}
              </div>
            </div>
          </div>

          {/* Available budget */}
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-0.5">Disponible ce mois</div>
            <div className={`text-lg font-bold font-mono ${
              summary.available >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {summary.available >= 0 ? '+' : ''}{summary.available.toFixed(0)} €
            </div>
            {summary.month_income > 0 && (
              <div className="text-xs text-slate-500">
                {summary.month_income.toFixed(0)} € revenus − {summary.total_actual.toFixed(0)} € dépenses
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Summary card ── */}
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

      {/* Legend */}
      {comparisons.some((c) => c.min_amount != null) && (
        <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-green-500/40 inline-block"/>sous min</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-amber-500/40 inline-block"/>zone cible</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-500/40 inline-block"/>au-dessus max</span>
        </div>
      )}

      {/* ── Per-category rows, sorted by urgency ── */}
      {sorted.length === 0 ? (
        <div className="card text-slate-400 text-center py-8">
          {t('budget.no_budget_set')}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => (
            <BudgetComparisonRow key={c.category_id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

function BudgetComparisonRow({ c }: { c: BudgetComparison }) {
  const hasRange = c.min_amount != null && c.max_amount != null;
  const min = c.min_amount ?? 0;
  const max = c.max_amount ?? c.budgeted;

  // Status
  let status: 'ok' | 'warning' | 'over';
  if (hasRange) {
    if (c.actual > max)       status = 'over';
    else if (c.actual >= min) status = 'warning';
    else                      status = 'ok';
  } else {
    if (c.actual > c.budgeted * 1.1)      status = 'over';
    else if (c.actual > c.budgeted * 0.9) status = 'warning';
    else                                   status = 'ok';
  }

  const actualColor =
    status === 'over' ? 'text-red-400' :
    status === 'warning' ? 'text-amber-400' : 'text-green-400';

  // Badge
  const badge = (() => {
    if (c.actual === 0) return <span className="text-xs text-slate-600 w-16 text-right">— €0</span>;
    const delta = c.actual - (hasRange ? max : c.budgeted);
    if (status === 'over') {
      return (
        <span className="text-xs font-medium text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 w-16 text-right tabular-nums">
          +{delta.toFixed(0)} €
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="text-xs font-medium text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 w-16 text-center">
          ⚠ zone
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-green-400 bg-green-500/10 rounded px-1.5 py-0.5 w-16 text-center">
        ✓ OK
      </span>
    );
  })();

  const refValue  = hasRange ? max * 1.15 : c.budgeted * 1.15;
  const minPct    = hasRange ? Math.min((min    / refValue) * 100, 100) : 0;
  const maxPct    = hasRange ? Math.min((max    / refValue) * 100, 100) : 100;
  const actualPct = Math.min((c.actual / refValue) * 100, 100);

  const rangeLabel = hasRange
    ? `${c.actual.toFixed(0)} / ${min.toFixed(0)}–${max.toFixed(0)} €`
    : `${c.actual.toFixed(0)} / ${c.budgeted.toFixed(0)} €`;

  return (
    <div className="card flex items-center gap-4 py-3">
      <span className="text-lg w-7 text-center">{c.category_icon ?? '🔖'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-slate-200 truncate">{c.category_label}</span>
          <span className={`text-xs font-mono ${actualColor}`}>{rangeLabel}</span>
        </div>

        {hasRange ? (
          <div className="relative w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-green-500/50" style={{ width: `${minPct}%` }} />
            <div className="absolute top-0 h-full bg-amber-500/50" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
            <div className="absolute top-0 h-full bg-red-500/40" style={{ left: `${maxPct}%`, width: `${100 - maxPct}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${actualPct}%` }} />
          </div>
        ) : (
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                c.percentage <= 90 ? 'bg-green-500' :
                c.percentage <= 110 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(c.percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
      {badge}
    </div>
  );
}

// ─── Setup View ──────────────────────────────────────────────────────────────

function SetupView({ fyId }: { fyId: number }) {
  const { t } = useTranslation();
  const { allFiscalYears } = useFiscalYear();
  const { data: categories = [] } = useActiveCategories();
  const { data: existingLines = [] } = useBudgetLines(fyId);
  const setBatchMut = useSetBudgetBatch();
  const computeAvgMut = useComputeAverages();

  const expenseCategories = categories.filter(
    (c) => c.type === 'fixed' || c.type === 'variable'
  );

  const [amounts, setAmounts] = useState<Record<number, AmountEntry>>({});
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!initialized && expenseCategories.length > 0) {
    const map: Record<number, AmountEntry> = {};
    for (const cat of expenseCategories) {
      const line = existingLines.find((l) => l.category_id === cat.id);
      map[cat.id] = {
        target: line ? String(line.monthly_amount) : '',
        min:    line?.min_amount != null ? String(line.min_amount) : '',
        max:    line?.max_amount != null ? String(line.max_amount) : '',
      };
    }
    setAmounts(map);
    setInitialized(true);
  }

  const otherFYs = allFiscalYears.filter((fy) => fy.id !== fyId);

  async function handlePrefill(sourceFyId: number) {
    const averages = await computeAvgMut.mutateAsync(sourceFyId);
    const newAmounts: Record<number, AmountEntry> = { ...amounts };
    for (const avg of averages) {
      if (avg.average > 0) {
        newAmounts[avg.categoryId] = {
          ...newAmounts[avg.categoryId],
          target: String(avg.average),
        };
      }
    }
    setAmounts(newAmounts);
  }

  const total = Object.values(amounts).reduce(
    (s, v) => s + (parseFloat(v.target) || 0), 0
  );

  async function handleSave() {
    const lines = Object.entries(amounts)
      .map(([catId, entry]) => ({
        categoryId: parseInt(catId),
        amount:    parseFloat(entry.target) || 0,
        minAmount: entry.min !== '' ? parseFloat(entry.min) : null,
        maxAmount: entry.max !== '' ? parseFloat(entry.max) : null,
      }))
      .filter((l) => l.amount > 0);

    try {
      await setBatchMut.mutateAsync({ fiscalYearId: fyId, lines });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[budget] Save error:', e);
    }
  }

  function setField(catId: number, field: keyof AmountEntry, val: string) {
    setAmounts((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [field]: val },
    }));
  }

  return (
    <div>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-400">{t('budget.setup_title')}</h2>
          <div className="flex items-center gap-3">
            {otherFYs.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">{t('budget.prefill_from')}:</span>
                {otherFYs.map((fy) => (
                  <button
                    key={fy.id}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-florin-400 transition-colors"
                    onClick={() => handlePrefill(fy.id)}
                    disabled={computeAvgMut.isPending}
                  >
                    📊 {fy.label}
                  </button>
                ))}
              </div>
            )}
            {saved && <span className="text-green-400 text-xs">✓ {t('budget.saved')}</span>}
            <span className="text-sm text-slate-300 font-mono">
              {t('budget.total')}: <span className="text-florin-400 font-bold">{total.toFixed(0)} €</span> /mois
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 pb-1 border-b border-slate-700 mb-1">
          <div className="w-6" />
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="flex-1 text-xs text-slate-500 uppercase tracking-wider">Catégorie</span>
          <div className="flex gap-1 w-64">
            <span className="w-20 text-xs text-slate-500 text-center">Min</span>
            <span className="w-20 text-xs text-florin-400 text-center font-medium">Cible</span>
            <span className="w-20 text-xs text-slate-500 text-center">Max</span>
          </div>
          <div className="w-4" />
        </div>

        <div className="space-y-0.5">
          <SectionHeader label={t('category.types.fixed')} />
          {expenseCategories.filter((c) => c.type === 'fixed').map((cat) => (
            <BudgetRow
              key={cat.id}
              category={cat}
              entry={amounts[cat.id] ?? { target: '', min: '', max: '' }}
              onChange={(field, val) => setField(cat.id, field, val)}
            />
          ))}

          <SectionHeader label={t('category.types.variable')} />
          {expenseCategories.filter((c) => c.type === 'variable').map((cat) => (
            <BudgetRow
              key={cat.id}
              category={cat}
              entry={amounts[cat.id] ?? { target: '', min: '', max: '' }}
              onChange={(field, val) => setField(cat.id, field, val)}
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

function BudgetRow({ category, entry, onChange }: {
  category: Category;
  entry: AmountEntry;
  onChange: (field: keyof AmountEntry, val: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-base w-6 text-center">{category.icon ?? '🔖'}</span>
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: category.color ?? '#64748b' }}
      />
      <span className="flex-1 text-sm text-slate-200">{category.label}</span>
      <div className="flex gap-1 items-center">
        {/* Min */}
        <div className="relative w-20">
          <input
            className="input text-right text-xs py-1 px-2 w-full text-slate-400 border-slate-700"
            type="number" step="10" min="0"
            value={entry.min}
            onChange={(e) => onChange('min', e.target.value)}
            placeholder="min"
          />
        </div>
        {/* Target */}
        <div className="relative w-20">
          <input
            className="input text-right text-sm py-1 px-2 w-full border-florin-500/50 font-medium"
            type="number" step="10" min="0"
            value={entry.target}
            onChange={(e) => onChange('target', e.target.value)}
            placeholder="cible"
          />
        </div>
        {/* Max */}
        <div className="relative w-20">
          <input
            className="input text-right text-xs py-1 px-2 w-full text-slate-400 border-slate-700"
            type="number" step="10" min="0"
            value={entry.max}
            onChange={(e) => onChange('max', e.target.value)}
            placeholder="max"
          />
        </div>
        <span className="text-xs text-slate-500 w-4">€</span>
      </div>
    </div>
  );
}
