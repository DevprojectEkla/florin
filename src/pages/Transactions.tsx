import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import { useTheme } from '../store/ThemeContext';
import { useTransactions, useUpdateTransactionCategory } from '../hooks/useTransactions';
import { useActiveCategories } from '../hooks/useCategories';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { useTransactionSelection } from '../hooks/useTransactionSelection';
import { usePagination } from '../hooks/usePagination';
import { splitLabel } from '../lib/utils';
import { parseSearchQuery, applySearchQuery } from '../lib/searchParser';
import { DataTable, VirtualDataTable, ColumnVisibilityMenu, PaginationControls } from '../components/table';
import { FilterPanel, PresetFilters } from '../components/filters';
import { StatsBar } from '../components/transactions/StatsBar';
import { BulkActionsToolbar } from '../components/transactions/BulkActionsToolbar';
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal';
import { ExportMenu } from '../components/transactions/ExportMenu';
import { AdvancedSearchInput } from '../components/transactions/AdvancedSearchInput';
import TransactionCharts from '../components/transactions/TransactionCharts';
import type { Column, SortConfig } from '../components/table';
import type { TransactionWithCategory } from '../db/transactions';

export default function Transactions() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const { selectedId: fyId, selected: selectedFiscalYear } = useFiscalYear();
  const { data: categories = [] } = useActiveCategories();

  // Support "All Years" mode when fyId is null
  const { data: transactions = [], isLoading } = useTransactions(fyId ?? null);

  // View mode: 'virtual' or 'paginated'
  const [viewMode, setViewMode] = useState<'virtual' | 'paginated'>(() => {
    const stored = localStorage.getItem('transactions:viewMode');
    return (stored === 'paginated' ? 'paginated' : 'virtual') as 'virtual' | 'paginated';
  });

  // Pagination
  const pagination = usePagination({
    storageKey: 'transactions',
    defaultItemsPerPage: 50,
  });

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('transactions:viewMode', viewMode);
  }, [viewMode]);

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
  } = useTransactionFilters();

  // Column visibility
  const defaultVisibleColumns = ['date', 'type', 'label', 'debit', 'credit', 'category'];
  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility(
    'transactions',
    defaultVisibleColumns
  );

  // Apply filters
  const filtered = useMemo(() => {
    // First apply all filters EXCEPT search (we'll handle search separately with advanced parser)
    const filtersWithoutSearch = { ...filters, search: undefined };
    const tempFilters = { ...filters };
    (tempFilters as any).search = undefined; // Temporarily remove search
    
    // Apply non-search filters
    const result = transactions.filter(tx => {
      // Date range
      if (filtersWithoutSearch.dateFrom && tx.date < filtersWithoutSearch.dateFrom) return false;
      if (filtersWithoutSearch.dateTo && tx.date > filtersWithoutSearch.dateTo) return false;

      // Amount range
      const amount = tx.debit || tx.credit || 0;
      if (filtersWithoutSearch.minAmount !== undefined && amount < filtersWithoutSearch.minAmount) return false;
      if (filtersWithoutSearch.maxAmount !== undefined && amount > filtersWithoutSearch.maxAmount) return false;

      // Categories (OR logic)
      if (filtersWithoutSearch.categories && filtersWithoutSearch.categories.length > 0) {
        if (!tx.category_id || !filtersWithoutSearch.categories.includes(tx.category_id)) {
          return false;
        }
      }

      // Type
      if (filtersWithoutSearch.type === 'debit' && !tx.debit) return false;
      if (filtersWithoutSearch.type === 'credit' && !tx.credit) return false;

      // Status
      if (filtersWithoutSearch.status === 'classified' && !tx.category_id) return false;
      if (filtersWithoutSearch.status === 'unclassified' && tx.category_id) return false;

      return true;
    });
    
    // Then apply advanced search on the filtered results
    if (filters.search) {
      const searchQuery = parseSearchQuery(filters.search);
      return applySearchQuery(result, searchQuery);
    }
    
    return result;
  }, [transactions, filters]);

  // Apply pagination if in paginated mode
  const displayData = viewMode === 'paginated' 
    ? pagination.getPaginatedData(filtered)
    : filtered;

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
  } = useTransactionSelection(displayData); // Use displayData for selection in paginated mode

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

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('nav.transactions')}</h1>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg">
            <button
              onClick={() => setViewMode('virtual')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'virtual'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Virtual scrolling (meilleur pour >1000 lignes)"
            >
              ∞ Virtual
            </button>
            <button
              onClick={() => setViewMode('paginated')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'paginated'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Pages (classique)"
            >
              📄 Pages
            </button>
          </div>

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

          {/* Advanced Search */}
          <AdvancedSearchInput
            value={filters.search || ''}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder={t('transactions.search')}
          />
        </div>
      </div>

      {/* Preset Filters */}
      <PresetFilters
        onApplyPreset={(preset) => setFilters({ ...filters, ...preset })}
        currentFilters={filters}
      />

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

      {/* Visual Statistics Charts */}
      {filtered.length > 0 && <TransactionCharts transactions={filtered} />}

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        selectedCount={selectedCount}
        categories={categories}
        onClearSelection={clearSelection}
      />

      {/* Count */}
      <p className="text-xs text-slate-500">
        {viewMode === 'paginated' 
          ? `${displayData.length} transactions (page ${pagination.currentPage})`
          : `${filtered.length} / ${transactions.length} transactions`}
      </p>

      {/* Table - Virtual or Paginated */}
      {viewMode === 'virtual' ? (
        <VirtualDataTable
          data={displayData}
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
      ) : (
        <div>
          <DataTable
            data={displayData}
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
          />
          <PaginationControls
            currentPage={pagination.currentPage}
            totalItems={filtered.length}
            itemsPerPage={pagination.itemsPerPage}
            onPageChange={pagination.setCurrentPage}
            onItemsPerPageChange={pagination.setItemsPerPage}
          />
        </div>
      )}

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
