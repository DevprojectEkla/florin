import { useState } from 'react';
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
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();

  // Default to current month
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [showYearOverview, setShowYearOverview] = useState(false);
  const [drilldownCategoryId, setDrilldownCategoryId] = useState<number | null | undefined>(undefined);

  const { data: unclassified = 0 } = useUnclassifiedCount(fyId);
  const { data: monthly = [] }     = useMonthlyAggregates(fyId);
  const { data: monthCategories = [] } = useCategoryAggregates(fyId, viewYear, viewMonth);

  // Current selected month data
  const currentMonthData = monthly.find(
    (m) => m.year === viewYear && m.month === viewMonth
  );

  // Year totals
  const yearTotals = {
    debit: monthly.reduce((s, m) => s + m.total_debit, 0),
    credit: monthly.reduce((s, m) => s + m.total_credit, 0),
    net: monthly.reduce((s, m) => s + m.net, 0),
  };

  // Month expenses (positive = spent)
  const monthExpenses = monthCategories
    .filter((c) => c.total > 0 && c.category_type !== 'income' && c.category_type !== 'transfer')
    .sort((a, b) => b.total - a.total);

  // Month income (negative total = credit > debit)
  const monthIncome = monthCategories
    .filter((c) => c.total < 0)
    .sort((a, b) => a.total - b.total);

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
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

  return (
    <div className="p-6 space-y-5">
      {/* Header with month picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="btn-ghost px-2 py-1" onClick={prevMonth}>←</button>
          <h1 className="text-xl font-bold text-slate-100">
            {t(`months.${viewMonth}`)} {viewYear}
          </h1>
          <button className="btn-ghost px-2 py-1" onClick={nextMonth}>→</button>
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

      {/* Bank balance — always visible, independent of month/year */}
      <BankBalanceCard />

      {/* Month KPIs */}
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

      {/* Month category breakdown */}
      {monthExpenses.length > 0 && (
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

      {/* Month income */}
      {monthIncome.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.month_income')}</h2>
          <div className="space-y-1">
            {monthIncome.map((cat) => (
              <div key={cat.category_id ?? 'null'} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{cat.category_icon ?? '💰'}</span>
                <span className="flex-1 text-sm text-slate-200">
                  {cat.category_label ?? t('transaction.unclassified')}
                </span>
                <span className="text-sm font-mono text-green-400">
                  +{Math.abs(cat.total).toFixed(0)} €
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data for this month */}
      {!currentMonthData && monthExpenses.length === 0 && (
        <div className="card text-center py-8 text-slate-500">
          {t('dashboard.no_month_data')}
        </div>
      )}

      {/* Year overview (toggle) */}
      {showYearOverview && monthly.length > 0 && (
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
