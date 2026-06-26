import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFiscalYear } from '../store/FiscalYearContext';
import {
  useTransactionCount,
  useUnclassifiedCount,
  useMonthlyAggregates,
  useCategoryAggregates,
} from '../hooks/useTransactions';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();
  const { data: txCount = 0 }         = useTransactionCount(fyId);
  const { data: unclassified = 0 }    = useUnclassifiedCount(fyId);
  const { data: monthly = [] }        = useMonthlyAggregates(fyId);
  const { data: categoryBreakdown = [] } = useCategoryAggregates(fyId);

  // Compute totals
  const totals = useMemo(() => {
    const totalDebit  = monthly.reduce((s, m) => s + m.total_debit, 0);
    const totalCredit = monthly.reduce((s, m) => s + m.total_credit, 0);
    return { totalDebit, totalCredit, net: totalCredit - totalDebit };
  }, [monthly]);

  // Current month data
  const now = new Date();
  const currentMonthData = monthly.find(
    (m) => m.year === now.getFullYear() && m.month === now.getMonth() + 1
  );

  // Expense categories (positive total = money spent)
  const expenses = categoryBreakdown
    .filter((c) => c.total > 0 && c.category_type !== 'income' && c.category_type !== 'transfer')
    .sort((a, b) => b.total - a.total);

  if (!fiscalYear) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-4">{t('nav.dashboard')}</h1>
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.dashboard')}</h1>
          <p className="text-slate-400 text-sm">{fiscalYear?.label ?? t('fiscal_year.all_years')}</p>
        </div>
        {unclassified > 0 && (
          <button
            className="badge bg-amber-500/15 text-amber-400 px-3 py-1.5 text-sm cursor-pointer hover:bg-amber-500/25 transition-colors"
            onClick={() => navigate('/transactions?filter=unclassified')}
          >
            ⚠️ {unclassified} {t('dashboard.unclassified')}
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label={t('dashboard.total_transactions')}
          value={String(txCount)}
          icon="📋"
        />
        <KpiCard
          label={t('dashboard.total_income')}
          value={`${totals.totalCredit.toFixed(0)} €`}
          icon="📈"
          color="text-green-400"
        />
        <KpiCard
          label={t('dashboard.total_expenses')}
          value={`${totals.totalDebit.toFixed(0)} €`}
          icon="📉"
          color="text-red-400"
        />
        <KpiCard
          label={t('dashboard.net_result')}
          value={`${totals.net >= 0 ? '+' : ''}${totals.net.toFixed(0)} €`}
          icon={totals.net >= 0 ? '✅' : '⚠️'}
          color={totals.net >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Current month */}
      {currentMonthData && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.this_month')}</h2>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm text-slate-500">{t('transaction.credit')}</div>
              <div className="text-lg font-bold text-green-400">{currentMonthData.total_credit.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">{t('transaction.debit')}</div>
              <div className="text-lg font-bold text-red-400">{currentMonthData.total_debit.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">{t('dashboard.net_result')}</div>
              <div className={`text-lg font-bold ${currentMonthData.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {currentMonthData.net >= 0 ? '+' : ''}{currentMonthData.net.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly overview */}
      {monthly.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-4">{t('dashboard.monthly_overview')}</h2>
          <div className="space-y-2">
            {monthly.map((m) => {
              const maxVal = Math.max(...monthly.map((x) => Math.max(x.total_debit, x.total_credit)));
              return (
                <div key={`${m.year}-${m.month}`} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-400 flex-shrink-0">
                    {t(`months.${m.month}`).slice(0, 4)} {m.year}
                  </span>
                  <div className="flex-1 flex gap-1 items-center">
                    <div
                      className="h-4 rounded bg-red-500/60"
                      style={{ width: `${(m.total_debit / maxVal) * 100}%` }}
                      title={`${m.total_debit.toFixed(0)} € dépensé`}
                    />
                    <div
                      className="h-4 rounded bg-green-500/60"
                      style={{ width: `${(m.total_credit / maxVal) * 100}%` }}
                      title={`${m.total_credit.toFixed(0)} € reçu`}
                    />
                  </div>
                  <span className={`text-xs font-mono w-16 text-right ${m.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.net >= 0 ? '+' : ''}{m.net.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top expenses by category */}
      {expenses.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-4">{t('dashboard.top_expenses')}</h2>
          <div className="space-y-2">
            {expenses.slice(0, 10).map((cat) => (
              <div key={cat.category_id ?? 'null'} className="flex items-center gap-3">
                <span className="w-6 text-center">{cat.category_icon ?? '🔖'}</span>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.category_color ?? '#64748b' }}
                />
                <span className="flex-1 text-sm text-slate-200 truncate">
                  {cat.category_label ?? t('transaction.unclassified')}
                </span>
                <span className="text-sm font-mono text-red-400">
                  {cat.total.toFixed(0)} €
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

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
