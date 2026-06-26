import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useTransactions, useUpdateTransactionCategory } from '../hooks/useTransactions';
import { useActiveCategories } from '../hooks/useCategories';
import type { TransactionWithCategory } from '../db/transactions';
import type { Category } from '../types';

export default function Transactions() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const filterUnclassified = searchParams.get('filter') === 'unclassified';

  const { selectedId: fyId } = useFiscalYear();
  const { data: categories = [] } = useActiveCategories();

  const { data: transactions = [], isLoading } = useTransactions(
    fyId,
    filterUnclassified ? { unclassifiedOnly: true } : undefined
  );

  const [showFilter, setShowFilter] = useState(filterUnclassified);
  const [search, setSearch] = useState('');

  const updateCategory = useUpdateTransactionCategory();

  // Filter
  const filtered = useMemo(() => {
    let list = transactions;
    if (showFilter) {
      list = list.filter((tx) => !tx.category_id);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (tx) =>
          tx.label.toLowerCase().includes(q) ||
          (tx.category_label ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, showFilter, search]);

  if (!fyId) {
    return (
      <div className="p-6">
        <div className="card text-slate-400">{t('dashboard.no_data')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header + controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('nav.transactions')}</h1>
        <div className="flex items-center gap-3">
          <input
            className="input w-60"
            placeholder={t('transactions.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              showFilter
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setShowFilter((v) => !v)}
          >
            {t('transactions.unclassified_only')} ({transactions.filter((t) => !t.category_id).length})
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-500">
        {filtered.length} / {transactions.length} transactions
      </p>

      {/* Table */}
      {isLoading ? (
        <div className="card text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-slate-400">{t('common.empty')}</div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left w-24">{t('transaction.date')}</th>
                <th className="px-3 py-2.5 text-left">{t('transaction.label')}</th>
                <th className="px-3 py-2.5 text-right w-24">{t('transaction.debit')}</th>
                <th className="px-3 py-2.5 text-right w-24">{t('transaction.credit')}</th>
                <th className="px-3 py-2.5 text-left w-48">{t('transaction.category')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  onCategoryChange={(catId) => updateCategory.mutate({ id: tx.id, categoryId: catId })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Transaction row ─────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  categories,
  onCategoryChange,
}: {
  tx: TransactionWithCategory;
  categories: Category[];
  onCategoryChange: (categoryId: number | null) => void;
}) {
  const { t } = useTranslation();

  // Shorten label for display (first line only)
  const displayLabel = tx.label_clean ?? tx.label.split('\n')[0].trim();

  return (
    <tr className="hover:bg-slate-700/30 transition-colors">
      <td className="px-3 py-2 text-slate-400 text-xs font-mono whitespace-nowrap">
        {tx.date}
      </td>
      <td className="px-3 py-2 text-slate-200 truncate max-w-xs" title={tx.label}>
        {displayLabel}
      </td>
      <td className="px-3 py-2 text-right">
        {tx.debit ? (
          <span className="amount-debit">{tx.debit.toFixed(2)}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right">
        {tx.credit ? (
          <span className="amount-credit">{tx.credit.toFixed(2)}</span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <select
          className={`w-full bg-transparent border rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
            tx.category_id
              ? 'border-slate-600 text-slate-200'
              : 'border-amber-500/50 text-amber-400'
          }`}
          value={tx.category_id ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onCategoryChange(val ? parseInt(val) : null);
          }}
        >
          <option value="">{t('transaction.unclassified')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
