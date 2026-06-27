# Advanced Transactions Page - Implementation Tasks

## Phase 1: Foundation (Week 1)

### Task 1.1: Enhanced Table Component
**Priority**: High | **Estimate**: 2 days

**Description**: Create a powerful, reusable table component with sorting and column management.

**Subtasks**:
- [ ] Create `components/table/DataTable.tsx` base component
- [ ] Implement sortable column headers with visual indicators (▲/▼)
- [ ] Add click to sort, click again to reverse, click third time to clear
- [ ] Support multi-column sorting (Shift+click)
- [ ] Create `components/table/TableHeader.tsx`
- [ ] Create `components/table/TableRow.tsx`
- [ ] Add prop for custom cell renderers
- [ ] Add loading skeleton state
- [ ] Add empty state component

**Acceptance**:
- Table renders correctly with 1000+ rows
- Sorting works on all columns
- Multi-sort with Shift+click functional
- Performance: sort completes in <50ms

---

### Task 1.2: Multi-Filter System
**Priority**: High | **Estimate**: 3 days

**Description**: Implement comprehensive filtering system with URL state management.

**Subtasks**:
- [ ] Create `components/filters/FilterPanel.tsx`
- [ ] Create `components/filters/DateRangeFilter.tsx` (from/to date pickers)
- [ ] Create `components/filters/AmountRangeFilter.tsx` (min/max inputs)
- [ ] Create `components/filters/CategoryFilter.tsx` (multi-select dropdown)
- [ ] Create `components/filters/TypeFilter.tsx` (debit/credit/both)
- [ ] Create `components/filters/StatusFilter.tsx` (classified/unclassified)
- [ ] Create `hooks/useTransactionFilters.ts` for filter logic
- [ ] Implement filter combination (AND logic)
- [ ] Sync filters with URL params for shareability
- [ ] Add "Active Filters" bar with badges
- [ ] Add "Clear All Filters" button
- [ ] Store filter state in URL: `?dateFrom=...&categories=1,2,3`

**Acceptance**:
- All filters work independently and together
- URL updates when filters change
- Page loads with filters from URL
- Filter application completes in <100ms for 10k transactions
- Active filters shown with count badge

---

### Task 1.3: Column Visibility Toggle
**Priority**: Medium | **Estimate**: 1 day

**Description**: Allow users to show/hide table columns.

**Subtasks**:
- [ ] Create `components/table/ColumnVisibilityMenu.tsx`
- [ ] Add dropdown with checkboxes for each column
- [ ] Persist visibility state in localStorage
- [ ] Update table to respect visibility settings
- [ ] Add "Reset to defaults" option
- [ ] Ensure at least one column always visible

**Acceptance**:
- Can hide/show any column
- Settings persist across sessions
- Table reflows correctly when columns hidden

---

### Task 1.4: Stats Bar Component
**Priority**: Medium | **Estimate**: 1 day

**Description**: Display aggregate statistics above the table.

**Subtasks**:
- [ ] Create `components/transactions/StatsBar.tsx`
- [ ] Calculate and display:
  - Total transaction count
  - Total debit sum
  - Total credit sum
  - Net balance (credit - debit)
  - Unclassified transaction count
- [ ] Update stats when filters change
- [ ] Add loading skeleton for stats
- [ ] Format numbers with locale (e.g., "1,234.56 €")

**Acceptance**:
- Stats accurately reflect filtered transactions
- Stats update reactively with filters
- Numbers formatted consistently

---

## Phase 2: Power Features (Week 2)

### Task 2.1: Bulk Selection System
**Priority**: High | **Estimate**: 2 days

**Description**: Enable multi-transaction selection for bulk operations.

**Subtasks**:
- [ ] Add checkbox column to table
- [ ] Implement "Select All" checkbox in header
- [ ] Handle individual row selection
- [ ] Create `useTransactionSelection.ts` hook
- [ ] Show selection count in toolbar
- [ ] Add "Clear selection" button
- [ ] Highlight selected rows visually
- [ ] Persist selection across pagination
- [ ] Add Cmd/Ctrl+A to select all visible

**Acceptance**:
- Can select individual or all transactions
- Selection count displayed accurately
- Selected rows highlighted
- Selection survives filtering (clears on filter change)

---

### Task 2.2: Bulk Operations Toolbar
**Priority**: High | **Estimate**: 2 days

**Description**: Implement bulk actions for selected transactions.

**Subtasks**:
- [ ] Create `components/transactions/BulkActionsToolbar.tsx`
- [ ] Show toolbar only when transactions selected
- [ ] Implement "Assign Category" bulk action
  - Show category selector dropdown
  - Apply to all selected
  - Optimistic UI update
  - Toast on success/error
- [ ] Implement "Mark as out of budget" toggle
- [ ] Implement "Delete selected" with confirmation dialog
- [ ] Add loading states during bulk operations
- [ ] Create `hooks/useBulkUpdateTransactions.ts`
- [ ] Handle partial failures (show which transactions failed)

**Acceptance**:
- Bulk category assignment works for 100+ transactions
- Optimistic updates with rollback on error
- Confirmation dialogs prevent accidents
- Clear feedback on success/failure

---

### Task 2.3: Transaction Detail Modal
**Priority**: High | **Estimate**: 3 days

**Description**: Create full-screen modal for viewing/editing transaction details.

**Subtasks**:
- [ ] Create `components/transactions/TransactionDetailModal.tsx`
- [ ] Display all transaction fields:
  - Date (editable with date picker)
  - Original label (readonly)
  - Clean label (readonly)
  - Amount (readonly, show debit or credit)
  - Category (searchable dropdown)
  - Out of budget flag (toggle)
  - Notes (textarea, create/edit)
  - Import batch info (readonly)
  - Created/updated timestamps (readonly)
- [ ] Add "Previous" and "Next" navigation buttons
- [ ] Add save/cancel buttons
- [ ] Handle keyboard shortcuts (Esc to close, Cmd+S to save)
- [ ] Add form validation
- [ ] Show loading state while saving
- [ ] Navigate through filtered transaction list (not all transactions)

**Acceptance**:
- Modal opens on row click
- All fields display correctly
- Changes save successfully
- Validation prevents invalid data
- Can navigate to adjacent transactions
- ESC closes modal, Cmd+S saves

---

### Task 2.4: Export Functionality
**Priority**: Medium | **Estimate**: 2 days

**Description**: Allow exporting transactions in multiple formats.

**Subtasks**:
- [ ] Create `components/transactions/ExportMenu.tsx`
- [ ] Implement CSV export
  - Use Papa Parse or similar
  - Include headers
  - Format dates and amounts correctly
- [ ] Implement Excel (.xlsx) export
  - Use xlsx library
  - Multiple sheets option
- [ ] Implement JSON export
- [ ] Add export options modal:
  - Current view (filtered)
  - Selected only
  - All in fiscal year
  - Column selection
- [ ] Generate filename: `florin-transactions-{fy}-{date}.{ext}`
- [ ] Show export progress for large datasets
- [ ] Add "Copy to clipboard" option

**Acceptance**:
- Can export to CSV, Excel, JSON
- Exports respect current filters
- Can export selected transactions
- Files download with correct names
- Large exports (5k+ rows) don't freeze UI

---

## Phase 3: Polish (Week 3)

### Task 3.1: Virtual Scrolling
**Priority**: High | **Estimate**: 2 days

**Description**: Implement virtual scrolling for optimal performance with large datasets.

**Subtasks**:
- [ ] Evaluate libraries: react-window vs react-virtualized vs TanStack Virtual
- [ ] Implement virtual scrolling in DataTable
- [ ] Calculate visible row window based on scroll position
- [ ] Render only visible rows + buffer
- [ ] Handle dynamic row heights (if needed)
- [ ] Ensure smooth scrolling (60fps)
- [ ] Test with 50k+ transactions
- [ ] Fix any jump/jank issues

**Acceptance**:
- Table scrolls smoothly with 50k+ rows
- No performance degradation
- Scroll position persists on filter/sort
- Works with row selection

---

### Task 3.2: Pagination Controls
**Priority**: Medium | **Estimate**: 1 day

**Description**: Add pagination as alternative to virtual scrolling.

**Subtasks**:
- [ ] Create `components/table/PaginationControls.tsx`
- [ ] Add per-page selector: 25/50/100/250/500
- [ ] Add page number buttons (first, prev, 1, 2, 3, ..., next, last)
- [ ] Add "Jump to page" input
- [ ] Show "X-Y of Z transactions"
- [ ] Persist per-page choice in localStorage
- [ ] Update URL with current page
- [ ] Disable next/prev at boundaries

**Acceptance**:
- Can navigate between pages
- Per-page selection works
- Page state persists in URL
- Jump to page input validated

---

### Task 3.3: Advanced Search
**Priority**: Medium | **Estimate**: 2 days

**Description**: Implement powerful search with operators and autocomplete.

**Subtasks**:
- [ ] Enhance search input with autocomplete
- [ ] Implement search operators:
  - Exact match: "phrase"
  - Exclude: -word
  - OR: word1 OR word2
  - Category: category:groceries
  - Amount: >100, <50, 50..100
  - Date: date:2026-03, date:today
- [ ] Create search parser function
- [ ] Show operator hints on focus
- [ ] Store recent searches in localStorage
- [ ] Add recent searches dropdown
- [ ] Debounce search input (300ms)

**Acceptance**:
- All search operators work
- Search suggestions appear
- Recent searches accessible
- Search is debounced appropriately

---

### Task 3.4: Preset Filters
**Priority**: Medium | **Estimate**: 1 day

**Description**: Quick-access filter presets for common scenarios.

**Subtasks**:
- [ ] Create `components/filters/PresetFilters.tsx`
- [ ] Implement built-in presets:
  - Unclassified
  - Last 30 days
  - Large expenses (>500€)
  - Income only
  - Transfers only
  - This month
  - Out of budget
- [ ] Add "Save current filter" button
- [ ] Create `components/filters/SaveFilterModal.tsx`
- [ ] Store saved filters in localStorage
- [ ] Add edit/delete for saved filters
- [ ] Show preset chips above table

**Acceptance**:
- Preset chips apply filters instantly
- Can save custom filter presets
- Saved presets persist
- Can edit/delete saved presets

---

### Task 3.5: Visual Statistics (Mini Charts)
**Priority**: Low | **Estimate**: 2 days

**Description**: Add visual representations of transaction data.

**Subtasks**:
- [ ] Install chart library (recharts or chart.js)
- [ ] Create `components/transactions/TransactionCharts.tsx`
- [ ] Implement pie/donut chart: Transactions by category
- [ ] Implement sparkline: Transactions over time
- [ ] Implement bar chart: Top 5 expenses
- [ ] Add chart tooltips
- [ ] Make charts responsive
- [ ] Update charts when filters change
- [ ] Add toggle to show/hide charts

**Acceptance**:
- Charts render correctly
- Charts update with filters
- Charts responsive on mobile
- Performance: chart renders in <200ms

---

## Phase 4: Optimization (Week 4)

### Task 4.1: Performance Tuning
**Priority**: High | **Estimate**: 2 days

**Description**: Optimize rendering and data processing.

**Subtasks**:
- [ ] Profile with React DevTools
- [ ] Add memoization where needed (useMemo, useCallback)
- [ ] Optimize filter function (early returns, indexing)
- [ ] Optimize sort function (use stable sort)
- [ ] Lazy load category dropdowns
- [ ] Add request debouncing for API calls
- [ ] Implement optimistic updates for category changes
- [ ] Add loading skeletons for better perceived performance
- [ ] Code-split heavy components (charts, export)

**Acceptance**:
- Initial render < 200ms for 1000 txs
- Filter application < 100ms for 10k txs
- Sort application < 50ms
- No unnecessary re-renders
- Lighthouse score 90+

---

### Task 4.2: Mobile Responsive Design
**Priority**: High | **Estimate**: 2 days

**Description**: Adapt UI for mobile devices.

**Subtasks**:
- [ ] Implement card layout for mobile (< 768px)
- [ ] Create `components/transactions/TransactionCard.tsx`
- [ ] Move filters to bottom sheet on mobile
- [ ] Implement swipe gestures for actions
- [ ] Stack transaction details vertically
- [ ] Make bulk actions touch-friendly
- [ ] Test on real devices (iOS Safari, Android Chrome)
- [ ] Optimize tap target sizes (min 44x44px)
- [ ] Add pull-to-refresh
- [ ] Reduce per-page count on mobile (25 default)

**Acceptance**:
- Table readable on mobile
- Filters accessible in bottom sheet
- All actions work with touch
- Swipe gestures intuitive
- Performance maintained on mobile

---

### Task 4.3: Accessibility Audit
**Priority**: Medium | **Estimate**: 1 day

**Description**: Ensure page is fully accessible.

**Subtasks**:
- [ ] Add ARIA labels to all interactive elements
- [ ] Test keyboard navigation throughout
  - Tab order logical
  - All actions accessible via keyboard
  - Focus indicators visible
- [ ] Add screen reader announcements for:
  - Filter changes
  - Selection count
  - Sort direction changes
  - Bulk operation results
- [ ] Test with VoiceOver/NVDA
- [ ] Check color contrast ratios (WCAG AA)
- [ ] Add skip links (skip to table, filters)
- [ ] Ensure modals trap focus
- [ ] Add keyboard shortcut hints

**Acceptance**:
- All WCAG 2.1 AA criteria met
- Full keyboard navigation works
- Screen reader announces changes
- Focus management correct in modals

---

### Task 4.4: User Testing & Polish
**Priority**: Medium | **Estimate**: 2 days

**Description**: Conduct user testing and refine UX.

**Subtasks**:
- [ ] Conduct user testing sessions (3-5 users)
- [ ] Gather feedback on usability
- [ ] Identify pain points and confusion
- [ ] Refine animations and transitions
- [ ] Add helpful tooltips
- [ ] Improve error messages
- [ ] Add onboarding hints for new features
- [ ] Polish loading states
- [ ] Refine responsive breakpoints
- [ ] Test edge cases (empty states, errors, slow network)

**Acceptance**:
- User satisfaction score 8+/10
- No major usability issues
- All edge cases handled gracefully
- Animations smooth and purposeful

---

## Testing Tasks (Throughout)

### Task T1: Unit Tests
- [ ] Test filter functions with various inputs
- [ ] Test sort functions for correctness
- [ ] Test selection logic (select all, individual, clear)
- [ ] Test bulk operation mutations
- [ ] Test URL state serialization/deserialization
- [ ] Test localStorage preferences

### Task T2: Integration Tests
- [ ] Test filter → sort → pagination flow
- [ ] Test bulk selection → bulk action flow
- [ ] Test search → filter combination
- [ ] Test detail modal → save → table update flow
- [ ] Test export with different options

### Task T3: E2E Tests
- [ ] Test complete user journey: arrive, filter, sort, select, bulk edit, export
- [ ] Test keyboard navigation throughout page
- [ ] Test mobile touch interactions
- [ ] Test error recovery scenarios

---

## Documentation Tasks

### Task D1: User Documentation
- [ ] Create user guide for new features
- [ ] Document keyboard shortcuts
- [ ] Create GIFs/videos for complex features
- [ ] Add in-app help tooltips

### Task D2: Developer Documentation
- [ ] Document component API
- [ ] Document filter system architecture
- [ ] Document state management patterns
- [ ] Add JSDoc comments to hooks

---

## Rollout Plan

1. **Alpha (Internal)**: Phase 1 + 2 → Test with dev team
2. **Beta (Limited)**: Phase 1-3 → Release to 10-20 beta users
3. **Release Candidate**: Phase 1-4 → Full feature set, final testing
4. **General Availability**: Roll out to all users with feature flag
5. **Gradual Rollout**: 10% → 50% → 100% over 2 weeks

---

## Success Metrics (Post-Launch)

- [ ] User engagement: 50% of users use advanced filters weekly
- [ ] Bulk operations: 30% of category assignments done via bulk
- [ ] Export usage: 20% of users export data monthly
- [ ] Performance: P95 filter time < 100ms
- [ ] Satisfaction: NPS score 40+ for transaction page
- [ ] Support tickets: <5% related to transaction page confusion

---

## Risks & Mitigation

**Risk**: Performance degrades with large datasets
- **Mitigation**: Virtual scrolling, pagination, indexed queries
- **Fallback**: Warn users with >10k transactions, suggest filtering

**Risk**: Complex UI overwhelming for casual users
- **Mitigation**: Progressive disclosure, simple mode by default, onboarding
- **Fallback**: Add "Simple view" toggle that hides advanced features

**Risk**: Bulk operations cause data corruption
- **Mitigation**: Transaction locking, optimistic updates with rollback
- **Fallback**: Add "Undo" for bulk operations, audit log

**Risk**: Browser compatibility issues
- **Mitigation**: Test on all major browsers, use polyfills
- **Fallback**: Graceful degradation for unsupported features

---

## Post-Launch Enhancements

- [ ] Column presets (save/load configurations)
- [ ] Transaction splitting (one tx → multiple categories)
- [ ] Duplicate detection
- [ ] Smart filters ("Similar to this transaction")
- [ ] Right-click context menu
- [ ] Keyboard macros
- [ ] Collaborative features (share filters)
- [ ] AI-powered category suggestions
