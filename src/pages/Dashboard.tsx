import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFiscalYear } from '../store/FiscalYearContext';
import {
  useUnclassifiedCount,
  useMonthlyAggregates,
  useCategoryAggregates,
  useTransactions,
  useUpdateTransactionCategory,
} from '../hooks/useTransactions';
import { useActiveCategories } from '../hooks/useCategories';
import { useCurrentBalance } from '../hooks/useBalance';
import { splitLabel } from '../lib/utils';
import type { TransactionWithCategory } from '../db/transactions';
import type { Category } from '../types';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selected: fiscalYear, selectedId: fyId, allFiscalYears, setSelectedId } = useFiscalYear();

  // Default to current month
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [showYearOverview, setShowYearOverview] = useState(false);
  const [drilldownCategoryId, setDrilldownCategoryId] = useState<number | null | undefined>(undefined);

  // When switching to "all years" mode, automatically show year overview
  useEffect(() => {
    if (fyId === null) {
      setShowYearOverview(true);
    }
  }, [fyId]);

  // When changing fiscal year, reset to the first month of that fiscal year
  useEffect(() => {
    if (fiscalYear) {
      setViewYear(fiscalYear.start_year);
      setViewMonth(fiscalYear.start_month);
    }
  }, [fiscalYear?.id]); // Only trigger when fiscal year ID changes

  const { data: unclassified = 0 } = useUnclassifiedCount(fyId);
  const { data: monthly = [] }     = useMonthlyAggregates(fyId);
  // Only fetch month categories when NOT in year overview mode
  const { data: monthCategories = [] } = useCategoryAggregates(
    showYearOverview ? null : fyId, 
    showYearOverview ? 0 : viewYear, 
    showYearOverview ? 0 : viewMonth
  );

  // Current selected month data
  const currentMonthData = monthly.find(
    (m) => m.year === viewYear && m.month === viewMonth
  );

  // Year totals (or all-years totals when fyId === null)
  const yearTotals = {
    debit: monthly.reduce((s, m) => s + m.total_debit, 0),
    credit: monthly.reduce((s, m) => s + m.total_credit, 0),
    net: monthly.reduce((s, m) => s + m.net, 0),
  };

  // Average per month
  const avgPerMonth = monthly.length > 0 ? {
    debit: yearTotals.debit / monthly.length,
    credit: yearTotals.credit / monthly.length,
    net: yearTotals.net / monthly.length,
  } : { debit: 0, credit: 0, net: 0 };

  // Month expenses (positive = spent)
  const monthExpenses = monthCategories
    .filter((c) => c.total > 0 && c.category_type !== 'income' && c.category_type !== 'transfer')
    .sort((a, b) => b.total - a.total);

  // Month income (negative total = credit > debit)
  // Exclude transfer.internal as it's not real income, just LEP → checking account movement
  const monthIncome = monthCategories
    .filter((c) => c.total < 0 && c.category_slug !== 'transfer.internal')
    .sort((a, b) => a.total - b.total);

  // Treasury movements (transfers between accounts)
  const monthTransfers = monthCategories
    .filter((c) => c.category_type === 'transfer')
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  function prevMonth() {
    // Calculate new month
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    if (fiscalYear) {
      const fyStartDate = new Date(fiscalYear.start_year, fiscalYear.start_month - 1);
      const newDate = new Date(newYear, newMonth - 1);
      
      // If we're trying to go before fiscal year start, switch to previous fiscal year
      if (newDate < fyStartDate) {
        // Find previous fiscal year (by start_year)
        const sortedFYs = [...allFiscalYears].sort((a, b) => {
          if (a.start_year !== b.start_year) return a.start_year - b.start_year;
          return a.start_month - b.start_month;
        });
        const currentIndex = sortedFYs.findIndex(fy => fy.id === fiscalYear.id);
        
        if (currentIndex > 0) {
          // Switch to previous fiscal year's last month (end month)
          const prevFY = sortedFYs[currentIndex - 1];
          setSelectedId(prevFY.id);
          // Will be reset to prevFY start by useEffect, but we want the end month
          // So we set it after a tick
          setTimeout(() => {
            let endMonth = prevFY.start_month - 1;
            let endYear = prevFY.start_year + 1;
            if (endMonth < 1) {
              endMonth = 12;
              endYear--;
            }
            setViewMonth(endMonth);
            setViewYear(endYear);
          }, 0);
          return;
        }
        // No previous fiscal year, stay at boundary
        return;
      }
    }
    
    // Normal navigation (no fiscal year or within bounds)
    setViewMonth(newMonth);
    setViewYear(newYear);
  }
  
  function nextMonth() {
    // Calculate new month
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    
    if (fiscalYear) {
      // Fiscal year ends 11 months after start month
      let fyEndMonth = fiscalYear.start_month - 1;
      let fyEndYear = fiscalYear.start_year + 1;
      if (fyEndMonth < 1) {
        fyEndMonth = 12;
        fyEndYear--;
      }
      
      const fyEndDate = new Date(fyEndYear, fyEndMonth - 1);
      const newDate = new Date(newYear, newMonth - 1);
      
      // If we're trying to go after fiscal year end, switch to next fiscal year
      if (newDate > fyEndDate) {
        // Find next fiscal year
        const sortedFYs = [...allFiscalYears].sort((a, b) => {
          if (a.start_year !== b.start_year) return a.start_year - b.start_year;
          return a.start_month - b.start_month;
        });
        const currentIndex = sortedFYs.findIndex(fy => fy.id === fiscalYear.id);
        
        if (currentIndex < sortedFYs.length - 1) {
          // Switch to next fiscal year (will auto-reset to its start month via useEffect)
          const nextFY = sortedFYs[currentIndex + 1];
          setSelectedId(nextFY.id);
          return;
        }
        // No next fiscal year, stay at boundary
        return;
      }
    }
    
    // Normal navigation (no fiscal year or within bounds)
    setViewMonth(newMonth);
    setViewYear(newYear);
  }

  if (!fiscalYear && fyId !== null) {
    return (
      <div className="p-6">
        <div className="card text-slate-400">
          {t('dashboard.no_data')}
          <button className="btn-primary ml-4" onClick={() => navigate('/import')}>
            {t('nav.import')}
          </button>
        </div>
      </div>
    );
  }

  // Navigate between fiscal years
  function prevFiscalYear() {
    if (!fiscalYear) return;
    const sortedFYs = [...allFiscalYears].sort((a, b) => {
      if (a.start_year !== b.start_year) return a.start_year - b.start_year;
      return a.start_month - b.start_month;
    });
    const currentIndex = sortedFYs.findIndex(fy => fy.id === fiscalYear.id);
    if (currentIndex > 0) {
      setSelectedId(sortedFYs[currentIndex - 1].id);
    }
  }

  function nextFiscalYear() {
    if (!fiscalYear) return;
    const sortedFYs = [...allFiscalYears].sort((a, b) => {
      if (a.start_year !== b.start_year) return a.start_year - b.start_year;
      return a.start_month - b.start_month;
    });
    const currentIndex = sortedFYs.findIndex(fy => fy.id === fiscalYear.id);
    if (currentIndex < sortedFYs.length - 1) {
      setSelectedId(sortedFYs[currentIndex + 1].id);
    }
  }

  // When fyId is null, we're in "all years" mode
  const isAllYearsMode = fyId === null;

  return (
    <div className="p-6 space-y-5">
      {/* Header - changes based on view mode */}
      {!isAllYearsMode && (
        <div className="flex items-center justify-between">
          {/* Navigation: Monthly or Yearly depending on view */}
          <div className="flex items-center gap-4">
            {showYearOverview ? (
              <>
                {/* Year navigation */}
                <button className="btn-ghost px-2 py-1" onClick={prevFiscalYear}>←</button>
                <h1 className="text-xl font-bold text-slate-100 w-48 text-center">
                  {fiscalYear?.label}
                </h1>
                <button className="btn-ghost px-2 py-1" onClick={nextFiscalYear}>→</button>
              </>
            ) : (
              <>
                {/* Month navigation */}
                <button className="btn-ghost px-2 py-1" onClick={prevMonth}>←</button>
                <h1 className="text-xl font-bold text-slate-100 w-48 text-center">
                  {t(`months.${viewMonth}`)} {viewYear}
                </h1>
                <button className="btn-ghost px-2 py-1" onClick={nextMonth}>→</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unclassified > 0 && (
              <button
                className="badge bg-amber-500/15 text-amber-400 px-3 py-1.5 text-sm cursor-pointer hover:bg-amber-500/25"
                onClick={() => navigate('/transactions?filter=unclassified')}
              >
                ⚠️ {unclassified} {t('dashboard.unclassified')}
              </button>
            )}
            <button
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                showYearOverview ? 'bg-florin-500/20 text-florin-400' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setShowYearOverview(!showYearOverview)}
            >
              {t('dashboard.year_view')}
            </button>
          </div>
        </div>
      )}

      {/* Header for all years mode */}
      {isAllYearsMode && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">
            {t('fiscal_year.all_years')}
            <span className="ml-3 text-sm text-slate-400">
              ({monthly.length} {t('dashboard.months_of_data')})
            </span>
          </h1>
          <div className="flex items-center gap-3">
            {unclassified > 0 && (
              <button
                className="badge bg-amber-500/15 text-amber-400 px-3 py-1.5 text-sm cursor-pointer hover:bg-amber-500/25"
                onClick={() => navigate('/transactions?filter=unclassified')}
              >
                ⚠️ {unclassified} {t('dashboard.unclassified')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bank balance — only visible for specific fiscal year */}
      {!isAllYearsMode && <BankBalanceCard />}

      {/* Investments/Savings summary */}
      <InvestmentsSummaryCard 
        fyId={fyId} 
        year={viewYear} 
        month={viewMonth}
        showYearTotal={showYearOverview || isAllYearsMode}
      />

      {/* Capital Investments summary */}
      <CapitalInvestmentsCard 
        fyId={fyId} 
        year={viewYear} 
        month={viewMonth}
        showYearTotal={showYearOverview || isAllYearsMode}
      />

      {/* KPIs: show month data OR year/all-years totals */}
      {!isAllYearsMode && !showYearOverview ? (
        // Month KPIs (specific fiscal year, month view)
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label={t('dashboard.month_income')}
            value={`${(currentMonthData?.total_credit ?? 0).toFixed(0)} €`}
            icon="📈"
            color="text-green-400"
          />
          <KpiCard
            label={t('dashboard.month_expenses')}
            value={`${(currentMonthData?.total_debit ?? 0).toFixed(0)} €`}
            icon="📉"
            color="text-red-400"
          />
          <KpiCard
            label={t('dashboard.month_balance')}
            value={`${(currentMonthData?.net ?? 0) >= 0 ? '+' : ''}${(currentMonthData?.net ?? 0).toFixed(0)} €`}
            icon={(currentMonthData?.net ?? 0) >= 0 ? '✅' : '⚠️'}
            color={(currentMonthData?.net ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      ) : (
        // Year totals KPIs (year overview or all-years mode)
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label={t('dashboard.total_income')}
            value={`${yearTotals.credit.toFixed(0)} €`}
            icon="📈"
            color="text-green-400"
          />
          <KpiCard
            label={t('dashboard.total_expenses')}
            value={`${yearTotals.debit.toFixed(0)} €`}
            icon="📉"
            color="text-red-400"
          />
          <KpiCard
            label={t('dashboard.total_balance')}
            value={`${yearTotals.net >= 0 ? '+' : ''}${yearTotals.net.toFixed(0)} €`}
            icon={yearTotals.net >= 0 ? '✅' : '⚠️'}
            color={yearTotals.net >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <KpiCard
            label={t('dashboard.avg_per_month')}
            value={`${avgPerMonth.net >= 0 ? '+' : ''}${avgPerMonth.net.toFixed(0)} €`}
            icon="📊"
            color={avgPerMonth.net >= 0 ? 'text-florin-400' : 'text-orange-400'}
          />
        </div>
      )}

      {/* Month category breakdown - only in month view (not year overview) */}
      {!isAllYearsMode && !showYearOverview && monthExpenses.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.month_by_category')}</h2>
          <div className="space-y-1">
            {monthExpenses.map((cat) => {
              const maxVal = monthExpenses[0]?.total ?? 1;
              const isOpen = drilldownCategoryId === cat.category_id;
              return (
                <div key={cat.category_id ?? 'null'}>
                  <button
                    className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors text-left ${
                      isOpen ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => setDrilldownCategoryId(isOpen ? undefined : cat.category_id)}
                  >
                    <span className="w-6 text-center text-sm">{cat.category_icon ?? '🔖'}</span>
                    <span className="w-32 text-sm text-slate-200 truncate">
                      {cat.category_label ?? t('transaction.unclassified')}
                    </span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(cat.total / maxVal) * 100}%`,
                          backgroundColor: cat.category_color ?? '#64748b',
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-slate-300 w-16 text-right">
                      {cat.total.toFixed(0)} €
                    </span>
                    <span className="text-xs text-slate-500 w-4">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {/* Drilldown: transactions for this category */}
                  {isOpen && (
                    <CategoryDrilldown
                      fyId={fyId}
                      categoryId={cat.category_id}
                      year={viewYear}
                      month={viewMonth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month income - only in month view (not year overview) */}
      {!isAllYearsMode && !showYearOverview && monthIncome.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.month_income')}</h2>
          <div className="space-y-1">
            {monthIncome.map((cat) => {
              const isOpen = drilldownCategoryId === cat.category_id;
              return (
                <div key={cat.category_id ?? 'null'}>
                  <button
                    className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors text-left ${
                      isOpen ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => setDrilldownCategoryId(isOpen ? undefined : cat.category_id)}
                  >
                    <span className="w-6 text-center text-sm">{cat.category_icon ?? '💰'}</span>
                    <span className="flex-1 text-sm text-slate-200">
                      {cat.category_label ?? t('transaction.unclassified')}
                    </span>
                    <span className="text-sm font-mono text-green-400">
                      +{Math.abs(cat.total).toFixed(0)} €
                    </span>
                    <span className="text-xs text-slate-500 w-4">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {/* Drilldown: transactions for this income category */}
                  {isOpen && (
                    <CategoryDrilldown
                      fyId={fyId}
                      categoryId={cat.category_id}
                      year={viewYear}
                      month={viewMonth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Treasury movements (transfers) - only in month view */}
      {!isAllYearsMode && !showYearOverview && monthTransfers.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">
            💱 {t('dashboard.month_transfers')}
          </h2>
          <div className="space-y-1">
            {monthTransfers.map((cat) => {
              const isOpen = drilldownCategoryId === cat.category_id;
              const isPositive = cat.total > 0;
              return (
                <div key={cat.category_id ?? 'null'}>
                  <button
                    className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors text-left ${
                      isOpen ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => setDrilldownCategoryId(isOpen ? undefined : cat.category_id)}
                  >
                    <span className="w-6 text-center text-sm">{cat.category_icon ?? '💱'}</span>
                    <span className="flex-1 text-sm text-slate-200">
                      {cat.category_label ?? t('transaction.unclassified')}
                    </span>
                    <span className={`text-sm font-mono ${isPositive ? 'text-orange-400' : 'text-blue-400'}`}>
                      {isPositive ? '-' : '+'}{Math.abs(cat.total).toFixed(0)} €
                    </span>
                    <span className="text-xs text-slate-500 w-4">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {/* Drilldown: transactions for this transfer category */}
                  {isOpen && (
                    <CategoryDrilldown
                      fyId={fyId}
                      categoryId={cat.category_id}
                      year={viewYear}
                      month={viewMonth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No data for this month - only in month view (not year overview) */}
      {!isAllYearsMode && !showYearOverview && !currentMonthData && monthExpenses.length === 0 && (
        <div className="card text-center py-8 text-slate-500">
          {t('dashboard.no_month_data')}
        </div>
      )}

      {/* Year overview (toggle or always visible in all-years mode) */}
      {(showYearOverview || isAllYearsMode) && monthly.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-400">{t('dashboard.monthly_overview')}</h2>
            <span className="text-xs text-slate-500">
              {t('dashboard.year_total')}: {yearTotals.net >= 0 ? '+' : ''}{yearTotals.net.toFixed(0)} €
            </span>
          </div>
          <div className="space-y-1.5">
            {monthly.map((m) => {
              const maxVal = Math.max(...monthly.map((x) => Math.max(x.total_debit, x.total_credit)), 1);
              const isSelected = m.year === viewYear && m.month === viewMonth;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  className={`w-full flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors text-left ${
                    isSelected ? 'bg-florin-500/10' : 'hover:bg-slate-700/50'
                  }`}
                  onClick={() => { setViewYear(m.year); setViewMonth(m.month); }}
                >
                  <span className={`w-16 text-xs flex-shrink-0 ${isSelected ? 'text-florin-400 font-medium' : 'text-slate-400'}`}>
                    {t(`months.${m.month}`).slice(0, 4)}
                  </span>
                  <div className="flex-1 flex gap-0.5 items-center">
                    <div
                      className="h-3 rounded-sm bg-red-500/60"
                      style={{ width: `${(m.total_debit / maxVal) * 100}%` }}
                    />
                    <div
                      className="h-3 rounded-sm bg-green-500/60"
                      style={{ width: `${(m.total_credit / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-14 text-right ${m.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.net >= 0 ? '+' : ''}{m.net.toFixed(0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }: {
  label: string; value: string; icon: string; color?: string;
}) {
  return (
    <div className="card flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-lg font-bold ${color ?? 'text-slate-100'}`}>{value}</div>
      </div>
    </div>
  );
}


// ─── Category Drilldown ──────────────────────────────────────────────────────

function CategoryDrilldown({ fyId, categoryId, year, month }: {
  fyId: number | null; categoryId: number | null; year: number; month: number;
}) {
  const { t } = useTranslation();
  const { data: categories = [] } = useActiveCategories();
  const updateCategory = useUpdateTransactionCategory();

  const { data: transactions = [], isLoading } = useTransactions(fyId, {
    year, month, categoryId: categoryId ?? undefined,
    unclassifiedOnly: categoryId === null,
  });

  if (isLoading) {
    return <div className="py-3 px-8 text-slate-500 text-xs">{t('common.loading')}</div>;
  }

  if (transactions.length === 0) {
    return <div className="py-3 px-8 text-slate-500 text-xs">{t('common.empty')}</div>;
  }

  return (
    <div className="ml-8 mr-2 my-2 border-l-2 border-slate-600 pl-3 space-y-0.5">
      {transactions.map((tx) => (
        <DrilldownRow
          key={tx.id}
          tx={tx}
          categories={categories}
          onCategoryChange={(catId) => updateCategory.mutate({ id: tx.id, categoryId: catId })}
        />
      ))}
    </div>
  );
}

function DrilldownRow({ tx, categories, onCategoryChange }: {
  tx: TransactionWithCategory;
  categories: Category[];
  onCategoryChange: (categoryId: number | null) => void;
}) {
  const { type, detail } = splitLabel(tx.label_clean ?? tx.label);

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span className="text-xs text-slate-500 font-mono w-20 flex-shrink-0">{tx.date}</span>
      <span className="text-xs text-slate-500 bg-slate-700/50 px-1 rounded flex-shrink-0">{type}</span>
      <span className="text-xs text-slate-300 flex-1 truncate" title={tx.label}>{detail}</span>
      <span className="text-xs font-mono w-16 text-right flex-shrink-0">
        {tx.debit ? (
          <span className="text-red-400">{tx.debit.toFixed(2)}</span>
        ) : (
          <span className="text-green-400">+{tx.credit?.toFixed(2)}</span>
        )}
      </span>
      <select
        className="bg-transparent border border-slate-600 rounded px-1.5 py-0.5 text-xs text-slate-300 w-36 flex-shrink-0
                   opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
        value={tx.category_id ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onCategoryChange(val ? parseInt(val) : null);
        }}
      >
        <option value="">—</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
        ))}
      </select>
    </div>
  );
}


// ─── Bank Balance Card ───────────────────────────────────────────────────────

function BankBalanceCard() {
  const { t } = useTranslation();
  const { data: balanceData } = useCurrentBalance();

  if (!balanceData) return null;

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 rounded-xl border border-slate-700 px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider">{t('dashboard.bank_balance')}</span>
          <div className={`text-2xl font-bold mt-0.5 ${
            balanceData.balance >= 0 ? 'text-florin-400' : 'text-red-400'
          }`}>
            {balanceData.balance.toFixed(2)} €
          </div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-xs text-slate-500">
            {t('dashboard.opening_balance')}: {balanceData.openingBalance.toFixed(2)} € ({balanceData.fiscalYearLabel})
          </div>
          <div className="text-xs text-green-400/70">
            + {balanceData.totalCredits.toFixed(0)} €
          </div>
          <div className="text-xs text-red-400/70">
            − {balanceData.totalDebits.toFixed(0)} €
          </div>
          <div className="text-xs text-slate-600">
            {balanceData.transactionCount} tx {balanceData.startDate ? `(${t('dashboard.since')} ${balanceData.startDate})` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Investments Summary Card ────────────────────────────────────────────────

function InvestmentsSummaryCard({ fyId, year, month, showYearTotal }: { 
  fyId: number | null; 
  year: number; 
  month: number;
  showYearTotal: boolean;
}) {
  const { t } = useTranslation();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const { data: transactions = [] } = useTransactions(fyId, showYearTotal ? {} : { year, month });

  if (!transactions || transactions.length === 0) return null;

  // Calculate investments by savings category
  // For savings: debit = money going INTO savings (e.g., transfer to LEP)
  // For LEP specifically, we need to subtract "transfer.internal" credits (withdrawals from LEP back to checking)
  const savingsTransactions = transactions.filter(tx => tx.category_type === 'savings');
  
  // Calculate total internal transfer credits (withdrawals from savings accounts)
  const internalTransferCredits = transactions
    .filter(tx => tx.category_slug === 'transfer.internal' && tx.credit && tx.credit > 0)
    .reduce((sum, tx) => sum + (tx.credit || 0), 0);

  const investments = savingsTransactions
    .reduce((acc, tx) => {
      const key = tx.category_slug || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          label: tx.category_label || 'Unknown',
          icon: tx.category_icon || '💰',
          total: 0,
          count: 0,
          transactions: [],
        };
      }
      // For savings: debit = deposits (positive contribution)
      acc[key].total += (tx.debit || 0);
      acc[key].count += 1;
      acc[key].transactions.push(tx);
      return acc;
    }, {} as Record<string, { label: string; icon: string; total: number; count: number; transactions: TransactionWithCategory[] }>);

  // For LEP savings: subtract internal transfers (withdrawals)
  // This gives us net savings = deposits - withdrawals
  if (investments['savings.lep']) {
    investments['savings.lep'].total -= internalTransferCredits;
  }

  const investmentsList = Object.entries(investments)
    .sort((a, b) => b[1].total - a[1].total);

  const totalInvestments = investmentsList.reduce((sum, [, inv]) => sum + inv.total, 0);

  if (investmentsList.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-900/20 to-emerald-800/10 rounded-xl border border-emerald-700/30 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-emerald-400/70 uppercase tracking-wider">
            {showYearTotal 
              ? t('dashboard.investments_summary_year') 
              : t('dashboard.investments_summary_month')}
          </span>
          <div className="text-2xl font-bold mt-0.5 text-emerald-400">
            {totalInvestments.toFixed(2)} €
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mt-3">
        {investmentsList.map(([slug, inv]) => {
          const isExpanded = expandedSlug === slug;
          return (
            <div key={slug}>
              <button
                onClick={() => setExpandedSlug(isExpanded ? null : slug)}
                className={`w-full bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/50 hover:bg-slate-800/60 transition-colors text-left ${
                  isExpanded ? 'border-emerald-600/50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{inv.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm text-slate-300 font-medium">{inv.label}</div>
                      <div className="text-xs text-slate-500">
                        {inv.count} {inv.count === 1 ? 'versement' : 'versements'}
                        {slug === 'savings.lep' && internalTransferCredits > 0 && 
                          ` (net après ${internalTransferCredits.toFixed(0)}€ retraits)`
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-emerald-400">
                      {inv.total.toFixed(0)} €
                    </div>
                    <span className="text-xs text-slate-500 w-4">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>
              </button>

              {/* Drilldown: transaction details */}
              {isExpanded && (
                <div className="ml-8 mr-2 my-2 border-l-2 border-emerald-600/30 pl-3 space-y-0.5">
                  {inv.transactions
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((tx) => {
                      const { type, detail } = splitLabel(tx.label_clean ?? tx.label);
                      return (
                        <div key={tx.id} className="flex items-center gap-2 py-1 text-sm">
                          <span className="text-xs text-slate-500 font-mono w-20 flex-shrink-0">{tx.date}</span>
                          <span className="text-xs text-emerald-600/70 bg-emerald-900/20 px-1.5 py-0.5 rounded flex-shrink-0">{type}</span>
                          <span className="text-xs text-slate-300 flex-1 truncate" title={tx.label}>{detail}</span>
                          <span className="text-xs font-mono text-emerald-400 w-20 text-right flex-shrink-0">
                            {tx.debit?.toFixed(2)} €
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Capital Investments Card ───────────────────────────────────────────────

function CapitalInvestmentsCard({ fyId, year, month, showYearTotal }: { 
  fyId: number | null; 
  year: number; 
  month: number;
  showYearTotal: boolean;
}) {
  const { t } = useTranslation();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const { data: transactions = [] } = useTransactions(fyId, showYearTotal ? {} : { year, month });

  if (!transactions || transactions.length === 0) return null;

  // Calculate capital investments by category
  const investments = transactions
    .filter(tx => tx.category_type === 'capital' && tx.debit && tx.debit > 0)
    .reduce((acc, tx) => {
      const key = tx.category_slug || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          label: tx.category_label || 'Unknown',
          icon: tx.category_icon || '📦',
          total: 0,
          count: 0,
          transactions: [],
        };
      }
      acc[key].total += tx.debit || 0;
      acc[key].count += 1;
      acc[key].transactions.push(tx);
      return acc;
    }, {} as Record<string, { label: string; icon: string; total: number; count: number; transactions: TransactionWithCategory[] }>);

  const investmentsList = Object.entries(investments)
    .sort((a, b) => b[1].total - a[1].total);

  const totalInvestments = investmentsList.reduce((sum, [, inv]) => sum + inv.total, 0);

  if (investmentsList.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-xl border border-purple-700/30 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-purple-400/70 uppercase tracking-wider">
            {showYearTotal 
              ? t('dashboard.capital_investments_year') 
              : t('dashboard.capital_investments_month')}
          </span>
          <div className="text-2xl font-bold mt-0.5 text-purple-400">
            {totalInvestments.toFixed(2)} €
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mt-3">
        {investmentsList.map(([slug, inv]) => {
          const isExpanded = expandedSlug === slug;
          return (
            <div key={slug}>
              <button
                onClick={() => setExpandedSlug(isExpanded ? null : slug)}
                className={`w-full bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/50 hover:bg-slate-800/60 transition-colors text-left ${
                  isExpanded ? 'border-purple-600/50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{inv.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm text-slate-300 font-medium">{inv.label}</div>
                      <div className="text-xs text-slate-500">
                        {inv.count} {inv.count === 1 ? 'achat' : 'achats'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-purple-400">
                      {inv.total.toFixed(0)} €
                    </div>
                    <span className="text-xs text-slate-500 w-4">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>
              </button>

              {/* Drilldown: transaction details */}
              {isExpanded && (
                <div className="ml-8 mr-2 my-2 border-l-2 border-purple-600/30 pl-3 space-y-0.5">
                  {inv.transactions
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((tx) => {
                      const { type, detail } = splitLabel(tx.label_clean ?? tx.label);
                      return (
                        <div key={tx.id} className="flex items-center gap-2 py-1 text-sm">
                          <span className="text-xs text-slate-500 font-mono w-20 flex-shrink-0">{tx.date}</span>
                          <span className="text-xs text-purple-600/70 bg-purple-900/20 px-1.5 py-0.5 rounded flex-shrink-0">{type}</span>
                          <span className="text-xs text-slate-300 flex-1 truncate" title={tx.label}>{detail}</span>
                          <span className="text-xs font-mono text-purple-400 w-20 text-right flex-shrink-0">
                            {tx.debit?.toFixed(2)} €
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
