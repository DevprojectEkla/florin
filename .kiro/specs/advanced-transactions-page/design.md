# Advanced Transactions Page - Design

## UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│ 📊 Transactions                                    [Search 🔍] │
├────────────────────────────────────────────────────────────────┤
│ [🎯 Filters ▼]  [Presets: Unclassified | Last 30d | Income ] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 📅 Date Range: [From] → [To]     ⚡ Active: 3 [Clear All] ││
│ │ 💰 Amount: [Min] → [Max]                                   ││
│ │ 🏷️  Category: [Multi-select ▼]                            ││
│ │ 📂 Type: [All ▼] Status: [All ▼]                          ││
│ └─────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────┤
│ 📊 1,234 transactions | €12,345 in | €8,900 out | €3,445 net│
│     234 unclassified                                           │
├────────────────────────────────────────────────────────────────┤
│ [☑️ Select All] [Bulk: Assign Category ▼] [Export ▼]         │
├────────────────────────────────────────────────────────────────┤
│ ┌──┬────────┬──────┬──────────────┬────────┬────────┬────────┐│
│ │☑️│Date ▼  │Type  │Label         │Debit   │Credit  │Category││
│ ├──┼────────┼──────┼──────────────┼────────┼────────┼────────┤│
│ │☑️│2026-03 │VIR   │Salary March  │        │+3000.00│💰Salary││
│ │☐ │2026-03 │CB    │Supermarket   │  45.20 │        │🛒Food  ││
│ │☐ │2026-03 │VIR   │Rent Payment  │ 800.00 │        │🏠Rent  ││
│ │☐ │2026-03 │CB    │Gas Station   │  60.00 │        │⚠️ —   ││
│ │☐ │2026-02 │PRLV  │Internet      │  39.99 │        │📡Net  ││
│ │                        ...                                  ││
│ └──────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────┤
│ Showing 1-50 of 1,234  [< 1 2 3 ... 25 >] [50 per page ▼]    │
└────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
TransactionsPage
├── TransactionHeader
│   ├── Title
│   └── SearchBar (with autocomplete)
│
├── FilterPanel (collapsible)
│   ├── PresetFilters (chips)
│   ├── DateRangeFilter
│   ├── AmountRangeFilter
│   ├── CategoryFilter (multi-select)
│   ├── TypeFilter (dropdown)
│   ├── StatusFilter (dropdown)
│   └── ActiveFiltersBar (with badges & clear)
│
├── StatsBar
│   ├── TransactionCount
│   ├── TotalDebit
│   ├── TotalCredit
│   ├── NetBalance
│   └── UnclassifiedCount
│
├── BulkActionsToolbar (conditional)
│   ├── SelectionCount
│   ├── BulkCategoryAssign
│   ├── BulkMarkBudget
│   ├── BulkDelete
│   └── BulkExport
│
├── TransactionTable
│   ├── TableHeader
│   │   ├── SelectAllCheckbox
│   │   ├── SortableColumnHeaders
│   │   └── ColumnVisibilityMenu
│   │
│   ├── TableBody (virtualized)
│   │   └── TransactionRow[]
│   │       ├── RowCheckbox
│   │       ├── DateCell
│   │       ├── TypeCell
│   │       ├── LabelCell
│   │       ├── DebitCell
│   │       ├── CreditCell
│   │       └── CategoryCell (inline edit)
│   │
│   └── TableFooter
│       └── PaginationControls
│
└── TransactionDetailModal (conditional)
    ├── ModalHeader (with prev/next nav)
    ├── ModalBody
    │   ├── DateField
    │   ├── LabelField
    │   ├── AmountField
    │   ├── CategoryField
    │   ├── BudgetFlagField
    │   ├── NotesField
    │   └── MetadataDisplay
    └── ModalFooter (Save/Cancel)
```

## State Management

### URL State (shareable)
```typescript
interface URLState {
  // Filters
  dateFrom?: string;        // ?dateFrom=2026-01-01
  dateTo?: string;          // ?dateTo=2026-03-31
  minAmount?: number;       // ?minAmount=100
  maxAmount?: number;       // ?maxAmount=1000
  categories?: number[];    // ?categories=1,2,3
  type?: 'debit'|'credit';  // ?type=debit
  status?: 'classified'|'unclassified'; // ?status=unclassified
  search?: string;          // ?search=salary
  
  // Sorting
  sortBy?: string;          // ?sortBy=date
  sortDir?: 'asc'|'desc';   // ?sortDir=desc
  
  // Pagination
  page?: number;            // ?page=2
  perPage?: number;         // ?perPage=100
}
```

### LocalStorage (preferences)
```typescript
interface UserPreferences {
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  rowDensity: 'compact' | 'comfortable' | 'spacious';
  defaultPerPage: number;
  savedFilters: SavedFilter[];
  recentSearches: string[];
}

interface SavedFilter {
  id: string;
  name: string;
  filters: URLState;
  createdAt: string;
}
```

### Component State
```typescript
interface TransactionsState {
  // Data
  transactions: TransactionWithCategory[];
  filteredTransactions: TransactionWithCategory[];
  isLoading: boolean;
  error: Error | null;
  
  // Selection
  selectedIds: Set<number>;
  isAllSelected: boolean;
  
  // UI
  isFilterPanelOpen: boolean;
  activePreset: string | null;
  detailModalTxId: number | null;
  
  // Table
  sortConfig: SortConfig[];
  currentPage: number;
  perPage: number;
}
```

## Data Flow

```
User Action
    ↓
Event Handler
    ↓
State Update (React State / URL / LocalStorage)
    ↓
Derived Data Computation (useMemo)
    ↓
Database Query (if needed)
    ↓
UI Re-render
    ↓
Visual Feedback (loading state, toast, etc.)
```

### Filter Flow Example
```typescript
1. User selects category filter → CategoryFilter onChange
2. Update URL param → useSearchParams.set('categories', '1,2,3')
3. URL change triggers → useEffect(() => { parseFiltersFromURL() })
4. Apply filters → useMemo(() => applyAllFilters(transactions, filters))
5. Update filtered list → setFilteredTransactions(result)
6. Table re-renders with new data
7. Stats bar updates → computed from filtered transactions
```

## Key Algorithms

### Multi-Column Filtering
```typescript
function applyFilters(
  transactions: Transaction[],
  filters: FilterState
): Transaction[] {
  return transactions.filter(tx => {
    // Date range
    if (filters.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters.dateTo && tx.date > filters.dateTo) return false;
    
    // Amount range
    const amount = tx.debit || tx.credit || 0;
    if (filters.minAmount && amount < filters.minAmount) return false;
    if (filters.maxAmount && amount > filters.maxAmount) return false;
    
    // Category (multi-select with OR logic)
    if (filters.categories?.length > 0) {
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
}
```

### Multi-Column Sorting
```typescript
interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

function applySorting(
  transactions: Transaction[],
  sortConfigs: SortConfig[]
): Transaction[] {
  if (sortConfigs.length === 0) return transactions;
  
  return [...transactions].sort((a, b) => {
    for (const config of sortConfigs) {
      const aVal = getNestedValue(a, config.column);
      const bVal = getNestedValue(b, config.column);
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      if (comparison !== 0) {
        return config.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
}
```

### Virtual Scrolling
```typescript
function useVirtualScrolling(
  items: any[],
  containerHeight: number,
  rowHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);
  
  const visibleItems = items.slice(
    Math.max(0, visibleStart - 5), // buffer
    Math.min(items.length, visibleEnd + 5)
  );
  
  const offsetY = visibleStart * rowHeight;
  const totalHeight = items.length * rowHeight;
  
  return { visibleItems, offsetY, totalHeight, onScroll: setScrollTop };
}
```

## Design Tokens

### Colors
```typescript
const colors = {
  // Table
  tableHeaderBg: 'bg-slate-800',
  tableHeaderText: 'text-slate-400',
  tableRowHover: 'hover:bg-slate-700/30',
  tableRowSelected: 'bg-florin-500/10',
  tableBorder: 'border-slate-700',
  
  // Filters
  filterChipActive: 'bg-florin-500/20 text-florin-400',
  filterChipInactive: 'bg-slate-700 text-slate-400',
  filterBadge: 'bg-amber-500/15 text-amber-400',
  
  // Amounts
  debit: 'text-red-400',
  credit: 'text-green-400',
  
  // Status
  unclassified: 'text-amber-400 border-amber-500/50',
  classified: 'text-slate-200 border-slate-600',
};
```

### Spacing
```typescript
const spacing = {
  rowDensity: {
    compact: 'py-1',
    comfortable: 'py-2',
    spacious: 'py-3',
  },
  columnPadding: 'px-3',
  filterPanelPadding: 'p-4',
  modalPadding: 'p-6',
};
```

### Typography
```typescript
const typography = {
  tableHeader: 'text-xs uppercase tracking-wider font-medium',
  tableCell: 'text-sm',
  amount: 'font-mono',
  label: 'truncate',
  statsLabel: 'text-xs text-slate-500',
  statsValue: 'text-lg font-bold',
};
```

## Interactions

### Click Behaviors
- **Row click**: Open detail modal
- **Checkbox click**: Toggle selection (stop propagation)
- **Category dropdown click**: Edit inline (stop propagation)
- **Column header click**: Sort by column
- **Shift + Column header click**: Add to multi-sort
- **Preset chip click**: Apply filter preset

### Keyboard Shortcuts
```typescript
const shortcuts = {
  'Cmd/Ctrl + F': 'Focus search',
  'Cmd/Ctrl + K': 'Open command palette',
  'Cmd/Ctrl + A': 'Select all visible',
  'Cmd/Ctrl + D': 'Deselect all',
  'Esc': 'Close modal / Clear selection',
  'Enter': 'Open detail modal (on focused row)',
  'Space': 'Toggle checkbox (on focused row)',
  '↑/↓': 'Navigate rows',
  '←/→': 'Navigate columns',
  'Cmd/Ctrl + E': 'Export selected',
  'Cmd/Ctrl + Shift + F': 'Toggle filter panel',
};
```

### Hover States
- Row hover: Subtle background change
- Column header hover: Show resize handle
- Sort indicator appears on hover
- Checkbox becomes visible on row hover
- Action buttons appear on row hover

## Responsive Design

### Desktop (1200px+)
- Full table with all columns
- Side-by-side filters
- 100 rows per page

### Tablet (768px - 1199px)
- Collapsible filter panel
- Hide less important columns
- 50 rows per page

### Mobile (< 768px)
- Card layout instead of table
- Filters in bottom sheet
- 25 rows per page
- Swipe to reveal actions
- Stacked layout for transaction details

## Performance Targets

- Initial load: < 200ms
- Filter application: < 100ms
- Sort application: < 50ms
- Scroll at 60fps
- No jank on bulk operations
- Debounced search: 300ms
- Virtual scrolling enables 50k+ transactions

## Accessibility

- **ARIA labels**: All interactive elements
- **Keyboard navigation**: Tab order logical
- **Focus indicators**: Visible focus rings
- **Screen reader**: Announce filter changes, selection count, sort direction
- **Color contrast**: WCAG AA compliance
- **Skip links**: Jump to table, filters, actions

## Error Handling

### Network Errors
```
┌────────────────────────────────────────┐
│ ⚠️ Failed to load transactions         │
│                                        │
│ [Retry]  [Load from cache]            │
└────────────────────────────────────────┘
```

### Bulk Operation Errors
```
Toast: "Failed to update 3 of 10 transactions"
        [View details]
```

### Validation Errors
- Inline field validation in detail modal
- Red border + error message below field

## Future Enhancements

1. **Column presets**: Save/load column configurations
2. **Smart filters**: "Similar to this" transaction
3. **Aggregate rows**: Group by category with subtotals
4. **Inline editing**: Edit multiple fields without modal
5. **Quick actions**: Right-click context menu
6. **Keyboard macros**: Record action sequences
7. **Transaction templates**: Save frequently used tx
8. **Collaborative features**: Share filters with team
