import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangeFilter } from './DateRangeFilter';
import { AmountRangeFilter } from './AmountRangeFilter';
import { CategoryFilter } from './CategoryFilter';
import { TypeStatusFilters } from './TypeStatusFilters';
import type { Category } from '../../types';
import type { TransactionFilters } from '../../hooks/useTransactionFilters';

interface FilterPanelProps {
  filters: TransactionFilters;
  categories: Category[];
  onFiltersChange: (filters: Partial<TransactionFilters>) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

export function FilterPanel({
  filters,
  categories,
  onFiltersChange,
  onClearFilters,
  activeFilterCount,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(activeFilterCount > 0);

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-florin-400 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>🎯 {t('filters.filters')}</span>
          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {t('filters.active')}: 
              <span className="ml-1 px-2 py-0.5 bg-florin-500/20 text-florin-400 rounded-full">
                {activeFilterCount}
              </span>
            </span>
            <button
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              onClick={onClearFilters}
            >
              {t('filters.clear_all')}
            </button>
          </div>
        )}
      </div>

      {/* Filter Controls */}
      {isExpanded && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
          {/* Date Range */}
          <DateRangeFilter
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(dateFrom, dateTo) => 
              onFiltersChange({ ...filters, dateFrom, dateTo })
            }
          />

          {/* Amount Range */}
          <AmountRangeFilter
            minAmount={filters.minAmount}
            maxAmount={filters.maxAmount}
            onChange={(minAmount, maxAmount) =>
              onFiltersChange({ ...filters, minAmount, maxAmount })
            }
          />

          {/* Categories */}
          <CategoryFilter
            categories={categories}
            selectedCategories={filters.categories}
            onChange={(categories) =>
              onFiltersChange({ ...filters, categories })
            }
          />

          {/* Type & Status */}
          <TypeStatusFilters
            type={filters.type || null}
            status={filters.status || null}
            onTypeChange={(type) =>
              onFiltersChange({ ...filters, type })
            }
            onStatusChange={(status) =>
              onFiltersChange({ ...filters, status })
            }
          />
        </div>
      )}
    </div>
  );
}
