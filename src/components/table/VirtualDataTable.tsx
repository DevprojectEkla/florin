import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import type { DataTableProps, SortConfig, SortDirection } from './types';

/**
 * Virtual scrolling table component for high-performance rendering of large datasets.
 * Only renders visible rows + buffer, recycling DOM elements as you scroll.
 * 
 * Use this instead of DataTable when you have 1000+ rows for better performance.
 */
export function VirtualDataTable<T>({
  data,
  columns,
  visibleColumns,
  sortConfig: externalSortConfig,
  onSortChange,
  isLoading = false,
  emptyMessage = 'No data available',
  rowKey,
  onRowClick,
  className = '',
  selectable = false,
  selectedIds = new Set(),
  onSelectItem,
  onSelectAll,
  isAllSelected = false,
  isSomeSelected = false,
  estimatedRowHeight = 45, // Default row height in pixels
  overscan = 10, // Number of items to render outside visible area
}: DataTableProps<T> & {
  estimatedRowHeight?: number;
  overscan?: number;
}) {
  // Internal sort state (if not controlled)
  const [internalSortConfig, setInternalSortConfig] = useState<SortConfig[]>([]);
  
  const sortConfig = externalSortConfig ?? internalSortConfig;
  const setSortConfig = onSortChange ?? setInternalSortConfig;

  // Ref for the scrollable container
  const tableBodyRef = useRef<HTMLDivElement>(null);

  // Filter visible columns
  const displayColumns = useMemo(() => {
    if (!visibleColumns) return columns;
    return columns.filter(col => visibleColumns.has(col.id));
  }, [columns, visibleColumns]);

  // Handle column sort
  const handleSort = (columnId: string, addToExisting: boolean) => {
    if (addToExisting) {
      // Multi-column sort (Shift+Click)
      const existingIndex = sortConfig.findIndex(c => c.column === columnId);
      
      if (existingIndex >= 0) {
        // Column already in sort: cycle through asc → desc → remove
        const existing = sortConfig[existingIndex];
        const newDirection: SortDirection = 
          existing.direction === 'asc' ? 'desc' : 
          existing.direction === 'desc' ? null : 'asc';
        
        if (newDirection === null) {
          // Remove from sort
          setSortConfig(sortConfig.filter((_, i) => i !== existingIndex));
        } else {
          // Update direction
          setSortConfig(
            sortConfig.map((c, i) => 
              i === existingIndex ? { ...c, direction: newDirection } : c
            )
          );
        }
      } else {
        // Add to sort
        setSortConfig([...sortConfig, { column: columnId, direction: 'asc' }]);
      }
    } else {
      // Single-column sort (Regular click)
      const existing = sortConfig.find(c => c.column === columnId);
      const newDirection: SortDirection = 
        !existing || existing.direction === null ? 'asc' :
        existing.direction === 'asc' ? 'desc' : null;
      
      if (newDirection === null) {
        setSortConfig([]);
      } else {
        setSortConfig([{ column: columnId, direction: newDirection }]);
      }
    }
  };

  // Apply sorting
  const sortedData = useMemo(() => {
    if (sortConfig.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const config of sortConfig) {
        const column = displayColumns.find(c => c.id === config.column);
        if (!column || !config.direction) continue;

        let aVal: any;
        let bVal: any;

        if (typeof column.accessor === 'function') {
          aVal = column.accessor(a);
          bVal = column.accessor(b);
        } else {
          aVal = a[column.accessor as keyof T];
          bVal = b[column.accessor as keyof T];
        }

        // Handle null/undefined
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Compare values
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [data, sortConfig, displayColumns]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  // Get row key
  const getRowKey = (row: T, index: number): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    return row[rowKey] as any ?? index;
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
        <div className="p-8 text-center text-slate-400">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
        <div className="p-8 text-center text-slate-400">{emptyMessage}</div>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
      <div className="w-full">
        {/* Fixed Header */}
        <table className="w-full text-sm">
          <TableHeader 
            columns={displayColumns} 
            sortConfig={sortConfig} 
            onSort={handleSort}
            selectable={selectable}
            isAllSelected={isAllSelected}
            isSomeSelected={isSomeSelected}
            onSelectAll={onSelectAll}
          />
        </table>

        {/* Virtual Scrolling Body */}
        <div
          ref={tableBodyRef}
          className="overflow-auto"
          style={{ 
            height: '600px', // Fixed height for scrolling container
            contain: 'strict',
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Virtual rows */}
            {virtualItems.map((virtualRow) => {
              const row = sortedData[virtualRow.index];
              const key = getRowKey(row, virtualRow.index);

              return (
                <div
                  key={key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-700/50">
                      <TableRow
                        row={row}
                        columns={displayColumns}
                        onClick={onRowClick}
                        selectable={selectable}
                        isSelected={selectedIds.has(Number(key))}
                        onSelectItem={() => onSelectItem?.(Number(key))}
                      />
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
