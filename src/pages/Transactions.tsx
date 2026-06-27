import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useTransactions, useUpdateTransactionCategory } from '../hooks/useTransactions';
import { useActiveCategories } from '../hooks/useCategories';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { splitLabel } from '../lib/utils';
import { DataTable, ColumnVisibilityMenu } from '../components/table';
import { FilterPanel } from '../components/filters';
import type { Column, SortConfig } from '../components/table';
import type { TransactionWithCategory } from '../db/transactions';

export default function Transactions() {
  const { t } = useTranslation();

  const { selectedId: fyId } = useFiscalYear();
  const { data: categories = [] } = useActiveCategories();

  const { data: transactions = [], isLoading } = useTransactions(fyId);

  const [sortConfig, setSortConfig] = useState<SortConfig[]>([
    { column: 'date', direction: 'desc' } // Default: newest first
  ]);

  const updateCategory = useUpdateTransactionCategory();
  
  // New filter system
  const {
    filters,
    setFilters,
    clearFilters,
    activeFilterCount,
    applyFilters,
  } = useTransactionFilters();

  // Column visibility
  const defaultVisibleColumns = ['date', 'type', 'label', 'debit', 'credit', 'category'];
  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'transactions',
    defaultVisibleColumns
  );

  // Apply filters
  const filtered = useMemo(() => {
    return applyFilters(transactions);
  }, [transactions, applyFilters]);

  // Define table columns
  const columns: Column<TransactionWithCategory>[] = useMemo(() => [
    {
      id: 'date',
      label: t('transaction.date'),
      accessor: 'date',
      width: 'w-24',
      render: (value) => (
        <span className="text-slate-400 text-xs font-mono whitespace-nowrap">
          {value}
        </span>
      ),
    },
    {
      id: 'type',
      label: t('transaction.type'),
      accessor: (tx) => splitLabel(tx.label_clean ?? tx.label).type,
      width: 'w-28',
      render: (value) => (
        <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded whitespace-nowrap">
          {value || '—'}
        </span>
      ),
    },
    {
      id: 'label',
      label: t('transaction.label'),
      accessor: (tx) => splitLabel(tx.label_clean ?? tx.label).detail,
      render: (value, tx) => (
        <span className="text-slate-200 truncate max-w-xs block" title={tx.label}>
          {value}
        </span>
      ),
    },
    {
      id: 'debit',
      label: t('transaction.debit'),
      accessor: 'debit',
      width: 'w-24',
      align: 'right',
      render: (value) => 
        value ? <span className="amount-debit">{value.toFixed(2)}</span> : null,
    },
    {
      id: 'credit',
      label: t('transaction.credit'),
      accessor: 'credit',
      width: 'w-24',
      align: 'right',
      render: (value) =>
        value ? <span className="amount-credit">{value.toFixed(2)}</span> : null,
    },
    {
      id: 'category',
      label: t('transaction.category'),
      accessor: 'category_label',
      width: 'w-48',
      sortable: false, // Category edit dropdown, no sort
      render: (_, tx) => (
        <select
          className={`w-full bg-transparent border rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
            tx.category_id
              ? 'border-slate-600 text-slate-200'
              : 'border-amber-500/50 text-amber-400'
          }`}
          value={tx.category_id ?? ''}
          onChange={(e) => {
            e.stopPropagation(); // Don't trigger row click
            const val = e.target.value;
            updateCategory.mutate({ id: tx.id, categoryId: val ? parseInt(val) : null });
          }}
          onClick={(e) => e.stopPropagation()} // Don't trigger row click
        >
          <option value="">{t('transaction.unclassified')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      ),
    },
  ], [t, categories, updateCategory]);

  if (!fyId) {
    return (
      <div className="p-6">
        <div className="card text-slate-400">{t('dashboard.no_data')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('nav.transactions')}</h1>
        
        <div className="flex items-center gap-3">
          {/* Column Visibility */}
          <ColumnVisibilityMenu
            columns={columns}
            visibleColumns={visibleColumns}
            onVisibilityChange={toggleColumn}
            onResetToDefaults={resetToDefaults}
          />

          {/* Search */}
          <input
            className="input w-60"
            placeholder={t('transactions.search')}
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        categories={categories}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Count */}
      <p className="text-xs text-slate-500">
        {filtered.length} / {transactions.length} transactions
      </p>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        visibleColumns={visibleColumns}
        sortConfig={sortConfig}
        onSortChange={setSortConfig}
        isLoading={isLoading}
        emptyMessage={t('common.empty')}
        rowKey="id"
      />
    </div>
  );
}
