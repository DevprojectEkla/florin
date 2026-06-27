# Advanced Transactions Page - Requirements

## Overview
Transform the Transactions page into a full-featured, enterprise-grade transaction management interface with advanced filtering, sorting, bulk operations, and data visualization.

## Current State Analysis

### Existing Features ✅
- Basic search by label/category
- Filter: unclassified transactions only
- Inline category editing (dropdown per row)
- Transaction count display
- Fiscal year scoping

### Current Limitations ❌
- No column sorting
- No multi-column filtering
- No bulk operations
- No date range filtering
- No amount filtering
- No category type filtering
- No export functionality
- No pagination/virtual scrolling for large datasets
- No transaction details modal
- No visual stats/aggregates
- Column headers not clickable
- Fixed table layout (no column resize/reorder)

## Target User Stories

### US-1: Advanced Filtering
**As a user**, I want to filter transactions by multiple criteria simultaneously so I can find specific transactions quickly.

**Acceptance Criteria:**
- Filter by date range (from/to dates)
- Filter by amount range (min/max)
- Filter by category (multi-select)
- Filter by category type (income/fixed/variable/savings/transfer/capital)
- Filter by transaction type (debit/credit/both)
- Filter by classification status (classified/unclassified/both)
- Filter by search text (label contains)
- All filters work together (AND logic)
- Filter state persists during session
- Clear filters button
- Active filter count badge

### US-2: Column Sorting
**As a user**, I want to sort transactions by any column so I can analyze data in different orders.

**Acceptance Criteria:**
- Click column header to sort ascending
- Click again to sort descending
- Click third time to remove sort
- Visual indicator (▲/▼) for sort direction
- Sortable columns: date, label, debit, credit, category, type
- Multi-column sort (shift+click to add secondary sort)
- Default sort: date descending (newest first)

### US-3: Bulk Operations
**As a user**, I want to perform actions on multiple transactions at once so I can work more efficiently.

**Acceptance Criteria:**
- Checkbox to select individual transactions
- "Select all" checkbox in header
- "Select all on page" vs "Select all matching filter"
- Bulk actions toolbar appears when transactions selected
- Bulk actions:
  - Assign category to selected
  - Mark as out of budget / in budget
  - Delete selected (with confirmation)
  - Export selected
- Selection count display
- Clear selection button

### US-4: Enhanced Table UI
**As a user**, I want a more powerful table interface so I can work with data more efficiently.

**Acceptance Criteria:**
- Resizable columns (drag column border)
- Reorderable columns (drag column header)
- Show/hide columns toggle
- Sticky table header on scroll
- Row hover highlights
- Zebra striping option
- Compact/comfortable/spacious row density options
- Keyboard navigation (arrow keys, tab, enter to edit)

### US-5: Transaction Details & Quick Edit
**As a user**, I want to view and edit full transaction details without leaving the page.

**Acceptance Criteria:**
- Click row to open details modal/drawer
- Modal shows all fields:
  - Date (editable)
  - Label (original + clean)
  - Debit/Credit amount
  - Category (searchable dropdown)
  - Out of budget flag
  - Notes (add/edit)
  - Import batch info
  - Created/updated timestamps
- Save/cancel buttons
- Navigate to prev/next transaction (< > buttons)
- Close with ESC key

### US-6: Advanced Search
**As a user**, I want powerful search capabilities so I can find transactions by any field.

**Acceptance Criteria:**
- Search input with suggestions/autocomplete
- Search across: label, clean label, notes, category name
- Search operators:
  - Exact match: "exact phrase"
  - Exclude: -word
  - OR: word1 OR word2
  - Category: category:groceries
  - Amount: >100, <50, 50..100
  - Date: date:2026-03, date:today, date:last-month
- Recent searches dropdown
- Saved search filters

### US-7: Data Export
**As a user**, I want to export transaction data so I can use it in other tools.

**Acceptance Criteria:**
- Export formats: CSV, Excel (.xlsx), JSON
- Export options:
  - Current view (with filters applied)
  - Selected transactions
  - All transactions in fiscal year
  - Custom date range
- Column selection for export
- Include/exclude category details
- File naming: "florin-transactions-{fiscalYear}-{date}.{ext}"

### US-8: Visual Statistics
**As a user**, I want to see visual summaries of filtered transactions.

**Acceptance Criteria:**
- Stats bar above table showing:
  - Total transactions count
  - Total debit sum
  - Total credit sum
  - Net balance
  - Unclassified count
  - Average transaction amount
- Mini charts:
  - Transactions by category (pie/donut)
  - Transactions over time (sparkline)
  - Top 5 expenses bar chart
- Stats update with filters

### US-9: Pagination & Performance
**As a user**, I want the page to remain fast even with thousands of transactions.

**Acceptance Criteria:**
- Virtual scrolling for large datasets (1000+ rows)
- Pagination controls: 25/50/100/250/500 per page
- Page number selector
- Jump to page input
- "Loading..." state during data fetch
- Optimistic updates for category changes
- Debounced search (300ms)

### US-10: Preset Filters
**As a user**, I want quick access to common filter combinations.

**Acceptance Criteria:**
- Preset filter chips:
  - "Unclassified" (current)
  - "Last 30 days"
  - "Large expenses" (>500€)
  - "Income"
  - "Transfers"
  - "This month"
  - "Out of budget"
- Click preset to apply
- Can combine preset with additional filters
- User can create custom presets (saved to localStorage)

## Technical Requirements

### Performance
- Initial render < 200ms for 1000 transactions
- Filter application < 100ms
- Smooth scrolling (60fps)
- Lazy load category dropdowns

### Accessibility
- Keyboard navigation throughout
- ARIA labels for screen readers
- Focus management in modals
- Contrast ratios meet WCAG AA

### Data Integrity
- Optimistic UI updates
- Rollback on error
- Batch API calls for bulk operations
- Transaction locking during edit

### State Management
- URL params for shareable filter state
- localStorage for user preferences:
  - Column widths
  - Column order
  - Column visibility
  - Row density
  - Saved filters
- Session state for selections

## UI/UX Design Principles

1. **Progressive Disclosure**: Show simple interface by default, reveal advanced features on demand
2. **Immediate Feedback**: Loading states, success/error toasts, optimistic updates
3. **Keyboard First**: All actions accessible via keyboard
4. **Mobile Responsive**: Touch-friendly controls, swipe gestures, responsive table
5. **Consistency**: Match design system from Dashboard and other pages

## Out of Scope (Future Iterations)
- Transaction splitting (one tx → multiple categories)
- Recurring transaction detection
- Transaction merge/duplicate detection
- Attachment uploads (receipts)
- Transaction tagging system
- Comments/discussions on transactions
- Audit log / change history
- Transaction rules editor (moved to separate page)
- AI-powered category suggestions
- OCR for receipt scanning

## Success Metrics
- User can filter 10k transactions in <100ms
- 50% reduction in time to find specific transaction
- 80% of category assignments done via bulk operations
- Zero performance degradation up to 50k transactions
- User satisfaction score 8+/10

## Dependencies
- Existing `useTransactions` hook (may need enhancement for complex filters)
- Existing `useUpdateTransactionCategory` hook
- New hooks: `useBulkUpdateTransactions`, `useExportTransactions`
- UI library for table: Consider TanStack Table or build custom
- Virtual scrolling: Consider react-window or react-virtualized

## Risks & Mitigations
- **Risk**: Performance issues with large datasets
  - **Mitigation**: Virtual scrolling, pagination, indexed DB queries
- **Risk**: Complex filter UI overwhelming users
  - **Mitigation**: Progressive disclosure, preset filters, simple mode by default
- **Risk**: Bulk operations causing data inconsistencies
  - **Mitigation**: Transaction locking, optimistic updates with rollback, confirmation dialogs

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Enhanced table component with sorting
- Basic multi-filter system
- Column visibility toggles

### Phase 2: Power Features (Week 2)
- Bulk operations
- Transaction details modal
- Export functionality

### Phase 3: Polish (Week 3)
- Virtual scrolling / pagination
- Visual statistics
- Advanced search
- Saved filters

### Phase 4: Optimization (Week 4)
- Performance tuning
- Mobile responsive
- Accessibility audit
- User testing
