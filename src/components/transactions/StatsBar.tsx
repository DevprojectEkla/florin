import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TransactionWithCategory } from '../../db/transactions';

interface StatsBarProps {
  transactions: TransactionWithCategory[];
  isLoading?: boolean;
}

export function StatsBar({ transactions, isLoading = false }: StatsBarProps) {
  const { t } = useTranslation();

  // Calculate stats
  const stats = useMemo(() => {
    const totalCount = transactions.length;
    const totalDebit = transactions.reduce((sum, tx) => sum + (tx.debit || 0), 0);
    const totalCredit = transactions.reduce((sum, tx) => sum + (tx.credit || 0), 0);
    const netBalance = totalCredit - totalDebit;
    const unclassifiedCount = transactions.filter(tx => !tx.category_id).length;

    return {
      totalCount,
      totalDebit,
      totalCredit,
      netBalance,
      unclassifiedCount,
    };
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-pulse">
            <div className="h-3 bg-slate-700 rounded w-20 mb-2"></div>
            <div className="h-6 bg-slate-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Total Count */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-xs text-slate-400 mb-1">{t('stats.total_transactions')}</div>
        <div className="text-2xl font-semibold text-slate-100">
          {stats.totalCount.toLocaleString()}
        </div>
      </div>

      {/* Total Debit */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-xs text-slate-400 mb-1">{t('stats.total_debit')}</div>
        <div className="text-2xl font-semibold text-red-400">
          {formatCurrency(stats.totalDebit)} {t('common.currency')}
        </div>
      </div>

      {/* Total Credit */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-xs text-slate-400 mb-1">{t('stats.total_credit')}</div>
        <div className="text-2xl font-semibold text-green-400">
          {formatCurrency(stats.totalCredit)} {t('common.currency')}
        </div>
      </div>

      {/* Net Balance */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-xs text-slate-400 mb-1">{t('stats.net_balance')}</div>
        <div
          className={`text-2xl font-semibold ${
            stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {stats.netBalance >= 0 ? '+' : ''}
          {formatCurrency(stats.netBalance)} {t('common.currency')}
        </div>
      </div>

      {/* Unclassified Count */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-xs text-slate-400 mb-1">{t('stats.unclassified')}</div>
        <div
          className={`text-2xl font-semibold ${
            stats.unclassifiedCount > 0 ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {stats.unclassifiedCount}
          {stats.unclassifiedCount > 0 && (
            <span className="text-xs ml-1 text-amber-500/70">
              ({Math.round((stats.unclassifiedCount / stats.totalCount) * 100)}%)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
