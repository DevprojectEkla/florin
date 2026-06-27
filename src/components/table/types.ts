// Table component types

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface Column<T = any> {
  id: string;
  label: string;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  visibleColumns?: Set<string>;
  sortConfig?: SortConfig[];
  onSortChange?: (config: SortConfig[]) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: keyof T | ((row: T) => string | number);
  onRowClick?: (row: T) => void;
  className?: string;
}
