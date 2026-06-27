import { useState, useMemo } from 'react';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import type { DataTableProps, SortConfig, SortDirection } from './types';

export function DataTable<T>({
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
}: DataTableProps<T>) {
  // Internal sort state (if not controlled)
  const [internalSortConfig, setInternalSortConfig] = useState<SortConfig[]>([]);
  
  const sortConfig = externalSortConfig ?? internalSortConfig;
  const setSortConfig = onSortChange ?? setInternalSortConfig;

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

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
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
        <tbody className="divide-y divide-slate-700/50">
          {sortedData.map((row, index) => {
            const key = getRowKey(row, index);
            return (
              <TableRow
                key={key}
                row={row}
                columns={displayColumns}
                onClick={onRowClick}
                selectable={selectable}
                isSelected={selectedIds.has(Number(key))}
                onSelectItem={() => onSelectItem?.(Number(key))}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
