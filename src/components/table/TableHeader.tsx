import type { Column, SortConfig } from './types';

interface TableHeaderProps<T = any> {
  columns: Column<T>[];
  sortConfig: SortConfig[];
  onSort: (columnId: string, addToExisting: boolean) => void;
  selectable?: boolean;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
  onSelectAll?: () => void;
}

export function TableHeader<T>({ 
  columns, 
  sortConfig, 
  onSort,
  selectable = false,
  isAllSelected = false,
  isSomeSelected = false,
  onSelectAll,
}: TableHeaderProps<T>) {
  const getSortIcon = (columnId: string) => {
    const config = sortConfig.find(c => c.column === columnId);
    if (!config || !config.direction) return null;
    
    return config.direction === 'asc' ? '▲' : '▼';
  };

  const getSortIndex = (columnId: string) => {
    const index = sortConfig.findIndex(c => c.column === columnId);
    return index >= 0 && sortConfig.length > 1 ? index + 1 : null;
  };

  return (
    <thead>
      <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
        {selectable && (
          <th className="px-3 py-2.5 w-12">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = isSomeSelected;
                }
              }}
              onChange={onSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-florin-500 focus:ring-florin-500 focus:ring-offset-0"
              title="Select all"
            />
          </th>
        )}
        {columns.map((column) => {
          const sortIcon = getSortIcon(column.id);
          const sortIndex = getSortIndex(column.id);
          const isSortable = column.sortable !== false;

          return (
            <th
              key={column.id}
              className={`px-3 py-2.5 text-${column.align || 'left'} ${column.width || ''} ${
                isSortable ? 'cursor-pointer hover:text-slate-200 select-none' : ''
              }`}
              onClick={(e) => {
                if (isSortable) {
                  onSort(column.id, e.shiftKey);
                }
              }}
              title={isSortable ? 'Click to sort, Shift+Click to add to sort' : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span>{column.label}</span>
                {sortIcon && (
                  <span className="text-florin-400 text-xs">
                    {sortIcon}
                    {sortIndex && <sup className="text-[0.6rem]">{sortIndex}</sup>}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
