import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useTheme } from '../store/ThemeContext';
import { useTransactions, useUpdateTransactionCategory } from '../hooks/useTransactions';
import { useActiveCategories } from '../hooks/useCategories';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { useTransactionSelection } from '../hooks/useTransactionSelection';
import { splitLabel } from '../lib/utils';
import { VirtualDataTable, ColumnVisibilityMenu } from '../components/table';
import { FilterPanel } from '../components/filters';
import { StatsBar } from '../components/transactions/StatsBar';
import { BulkActionsToolbar } from '../components/transactions/BulkActionsToolbar';
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal';
import { ExportMenu } from '../components/transactions/ExportMenu';
import type { Column, SortConfig } from '../components/table';
import type { TransactionWithCategory } from '../db/transactions';

export default function Transactions() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const { selectedId: fyId, selected: selectedFiscalYear } = useFiscalYear();
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

  // Detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithCategory | null>(null);
  const selectedIndex = selectedTransaction 
    ? filtered.findIndex(tx => tx.id === selectedTransaction.id)
    : -1;

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (selectedIndex === -1) return;
    const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < filtered.length) {
      setSelectedTransaction(filtered[newIndex]);
    }
  };

  // Selection
  const {
    selectedIds,
    selectedCount,
    toggleItem,
    selectAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  } = useTransactionSelection(filtered);

  // Handle Cmd/Ctrl+A to select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && filtered.length > 0) {
        e.preventDefault();
        selectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered.length, selectAll]);

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
      width: 'max-w-md',
      render: (value, tx) => (
        <span className="text-slate-200 truncate block" title={tx.label}>
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
          className={`w-full border rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
            tx.category_id
              ? (theme === 'light' 
                  ? 'bg-white border-slate-300 text-slate-900' 
                  : 'bg-transparent border-slate-600 text-slate-200')
              : (theme === 'light'
                  ? 'bg-white border-amber-500/50 text-amber-600'
                  : 'bg-transparent border-amber-500/50 text-amber-400')
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
  ], [t, categories, updateCategory, theme]);

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
          {/* Export Menu */}
          <ExportMenu
            transactions={filtered}
            selectedIds={selectedIds}
            fiscalYearLabel={selectedFiscalYear?.label}
          />

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

      {/* Stats Bar */}
      <StatsBar transactions={filtered} isLoading={isLoading} />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        selectedCount={selectedCount}
        categories={categories}
        onClearSelection={clearSelection}
      />

      {/* Count */}
      <p className="text-xs text-slate-500">
        {filtered.length} / {transactions.length} transactions
      </p>

      {/* Table - Use VirtualDataTable for better performance with large datasets */}
      <VirtualDataTable
        data={filtered}
        columns={columns}
        visibleColumns={visibleColumns}
        sortConfig={sortConfig}
        onSortChange={setSortConfig}
        isLoading={isLoading}
        emptyMessage={t('common.empty')}
        rowKey="id"
        onRowClick={(row) => setSelectedTransaction(row)}
        selectable
        selectedIds={selectedIds}
        onSelectItem={toggleItem}
        onSelectAll={isAllSelected ? clearSelection : selectAll}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        estimatedRowHeight={45}
        overscan={5}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onNavigate={handleNavigate}
        canNavigatePrev={selectedIndex > 0}
        canNavigateNext={selectedIndex < filtered.length - 1}
      />
    </div>
  );
}
