import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransactionWithCategory } from '../db/transactions';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  categories?: number[];
  type?: 'debit' | 'credit' | null;
  status?: 'classified' | 'unclassified' | null;
  search?: string;
}

export function useTransactionFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters: TransactionFilters = useMemo(() => {
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const categories = searchParams.get('categories');
    const type = searchParams.get('type') as 'debit' | 'credit' | null;
    const status = searchParams.get('status') as 'classified' | 'unclassified' | null;
    const search = searchParams.get('search') || undefined;

    return {
      dateFrom,
      dateTo,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      categories: categories ? categories.split(',').map(Number) : undefined,
      type: type || null,
      status: status || null,
      search,
    };
  }, [searchParams]);

  // Update filters in URL
  const setFilters = (newFilters: Partial<TransactionFilters>) => {
    const params = new URLSearchParams(searchParams);

    // Remove existing filter params
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('minAmount');
    params.delete('maxAmount');
    params.delete('categories');
    params.delete('type');
    params.delete('status');
    params.delete('search');

    // Add new filter params
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
    if (newFilters.minAmount !== undefined) params.set('minAmount', String(newFilters.minAmount));
    if (newFilters.maxAmount !== undefined) params.set('maxAmount', String(newFilters.maxAmount));
    if (newFilters.categories && newFilters.categories.length > 0) {
      params.set('categories', newFilters.categories.join(','));
    }
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.search) params.set('search', newFilters.search);

    setSearchParams(params);
  };

  // Clear all filters
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('minAmount');
    params.delete('maxAmount');
    params.delete('categories');
    params.delete('type');
    params.delete('status');
    params.delete('search');
    params.delete('filter'); // Also clear legacy 'filter' param
    setSearchParams(params);
  };

  // Count active filters (exclude search from count)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) count++;
    if (filters.categories && filters.categories.length > 0) count++;
    if (filters.type) count++;
    if (filters.status) count++;
    return count;
  }, [filters]);

  // Apply filters to transaction list
  const applyFilters = (transactions: TransactionWithCategory[]): TransactionWithCategory[] => {
    return transactions.filter(tx => {
      // Date range
      if (filters.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters.dateTo && tx.date > filters.dateTo) return false;

      // Amount range
      const amount = tx.debit || tx.credit || 0;
      if (filters.minAmount !== undefined && amount < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && amount > filters.maxAmount) return false;

      // Categories (OR logic)
      if (filters.categories && filters.categories.length > 0) {
        if (!tx.category_id || !filters.categories.includes(tx.category_id)) {
          return false;
        }
      }

      // Type
      if (filters.type === 'debit' && !tx.debit) return false;
      if (filters.type === 'credit' && !tx.credit) return false;

      // Status
      if (filters.status === 'classified' && !tx.category_id) return false;
      if (filters.status === 'unclassified' && tx.category_id) return false;

      // Search text
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          tx.label,
          tx.label_clean,
          tx.category_label,
          tx.notes
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  };

  return {
    filters,
    setFilters,
    clearFilters,
    activeFilterCount,
    applyFilters,
  };
}
