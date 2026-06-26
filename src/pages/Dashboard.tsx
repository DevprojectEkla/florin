import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFiscalYear } from '../store/FiscalYearContext';
import {
  useUnclassifiedCount,
  useMonthlyAggregates,
  useCategoryAggregates,
} from '../hooks/useTransactions';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();

  // Default to current month
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [showYearOverview, setShowYearOverview] = useState(false);

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
          <div className="space-y-2">
            {monthExpenses.map((cat) => {
              const maxVal = monthExpenses[0]?.total ?? 1;
              return (
                <div key={cat.category_id ?? 'null'} className="flex items-center gap-3">
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
