import type { Column } from './types';

interface TableRowProps<T = any> {
  row: T;
  columns: Column<T>[];
  onClick?: (row: T) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onSelectItem?: () => void;
}

export function TableRow<T>({ 
  row, 
  columns, 
  onClick,
  selectable = false,
  isSelected = false,
  onSelectItem,
}: TableRowProps<T>) {
  const getCellValue = (column: Column<T>, row: T) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor as keyof T];
  };

  return (
    <tr
      className={`transition-colors ${
        isSelected ? 'bg-florin-500/10' : 'hover:bg-slate-700/30'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={() => onClick?.(row)}
    >
      {selectable && (
        <td className="px-3 py-2 w-12">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectItem?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-florin-500 focus:ring-florin-500 focus:ring-offset-0"
          />
        </td>
      )}
      {columns.map((column) => {
        const value = getCellValue(column, row);
        const rendered = column.render ? column.render(value, row) : value;

        return (
          <td
            key={column.id}
            className={`px-3 py-2 text-${column.align || 'left'} ${column.width || ''}`}
          >
            {rendered}
          </td>
        );
      })}
    </tr>
  );
}
