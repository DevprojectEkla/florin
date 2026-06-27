import type { Column } from './types';

interface TableRowProps<T = any> {
  row: T;
  columns: Column<T>[];
  onClick?: (row: T) => void;
}

export function TableRow<T>({ row, columns, onClick }: TableRowProps<T>) {
  const getCellValue = (column: Column<T>, row: T) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor as keyof T];
  };

  return (
    <tr
      className={`hover:bg-slate-700/30 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={() => onClick?.(row)}
    >
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
