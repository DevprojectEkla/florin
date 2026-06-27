# Light Mode Fix - Implementation Plan

**Date:** June 27, 2026  
**Priority:** Medium  
**Estimated Time:** 2-3 hours  
**Status:** 📋 Planning

---

## 🎯 Problem Statement

The application currently has a dark mode bias with several light mode issues:

### Current Issues

1. **Select elements have dark backgrounds in light mode**
   - Fiscal year selector in sidebar
   - Category dropdowns in transaction table
   - Root cause: `color-scheme: dark` in `globals.css` line 32

2. **No light mode color scheme defined**
   - Only dark mode CSS variables defined in `:root`
   - No `.light` class with light mode colors

3. **Hard-coded dark colors throughout components**
   - Many components use `bg-slate-800`, `text-slate-100`, etc.
   - Need `dark:` prefixes for proper theme switching

4. **Charts don't adapt to theme**
   - Recharts tooltips hard-coded with dark backgrounds
   - Need dynamic styling based on theme

---

## 📊 Affected Components

### High Priority (Broken in Light Mode)
- ✅ **Select dropdowns** - Dark backgrounds
- ✅ **Transaction table** - Category selects
- ✅ **Sidebar** - Fiscal year selector
- ✅ **Dashboard cards** - Dark backgrounds
- ✅ **Transaction charts** - Tooltip styling

### Medium Priority (Suboptimal)
- ⚠️ **Modal backgrounds** - Could be lighter
- ⚠️ **Input fields** - Dark themed
- ⚠️ **Buttons** - Ghost buttons may need adjustment
- ⚠️ **Filter panel** - Background colors

### Low Priority (Acceptable)
- ✓ **Text colors** - Mostly handled by Tailwind
- ✓ **Borders** - Tailwind handles well
- ✓ **Icons** - Emoji-based, theme agnostic

---

## 🔧 Implementation Strategy

### Phase 1: CSS Foundation (30 min)

**Goal:** Establish proper light/dark color schemes

#### 1.1 Update `globals.css`
```css
@layer base {
  /* Dark mode (default) */
  :root {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-card: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --accent: #eab308;
  }

  /* Light mode */
  .light {
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-card: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --accent: #eab308;
  }

  body {
    @apply bg-slate-900 dark:bg-slate-900 text-slate-100 dark:text-slate-100;
    @apply light:bg-white light:text-slate-900;
  }

  /* Fix select elements - respect theme */
  select {
    color-scheme: light dark;  /* Changed from 'dark' only */
  }
  
  /* Dark mode selects */
  .dark select {
    color-scheme: dark;
  }
  .dark select option {
    background-color: #1e293b;
    color: #e2e8f0;
  }
  
  /* Light mode selects */
  .light select {
    color-scheme: light;
  }
  .light select option {
    background-color: #ffffff;
    color: #0f172a;
  }
}
```

#### 1.2 Update Component Classes
Add `.dark` and `.light` responsive classes using Tailwind's `dark:` variant:

**Current:**
```tsx
className="bg-slate-800 text-slate-100"
```

**Fixed:**
```tsx
className="bg-slate-800 text-slate-100 dark:bg-slate-800 dark:text-slate-100 light:bg-white light:text-slate-900"
```

**Better (using Tailwind defaults):**
```tsx
className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
```

---

### Phase 2: Component Updates (60 min)

**Goal:** Update all major components with proper theme classes

#### 2.1 Core Layout Components
- [ ] `AppLayout.tsx` - Sidebar, main content area
- [ ] `Dashboard.tsx` - Cards, KPIs, charts
- [ ] `Transactions.tsx` - Table, filters

#### 2.2 Reusable Components
- [ ] `Modal.tsx` - Background overlay, content
- [ ] `DataTable.tsx` - Table rows, headers
- [ ] `FilterPanel.tsx` - Input backgrounds
- [ ] `StatsBar.tsx` - Card backgrounds
- [ ] `TransactionCharts.tsx` - Tooltip styling

#### 2.3 Update Pattern

**Example: Card Component**

**Before:**
```tsx
<div className="bg-slate-800 rounded-xl border border-slate-700 px-5 py-4">
```

**After:**
```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4">
```

**Example: Text Classes**

**Before:**
```tsx
<span className="text-slate-300">Label</span>
```

**After:**
```tsx
<span className="text-slate-700 dark:text-slate-300">Label</span>
```

---

### Phase 3: Dynamic Chart Theming (30 min)

**Goal:** Make Recharts adapt to theme

#### 3.1 Update `TransactionCharts.tsx`

Add theme-aware styling:

```tsx
export default function TransactionCharts({ transactions }: TransactionChartsProps) {
  const { theme } = useTheme();
  
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
    borderRadius: '8px',
    color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
  };
  
  return (
    // ...
    <Tooltip contentStyle={tooltipStyle} />
  );
}
```

#### 3.2 Chart Color Palettes

Create theme-specific color palettes:

```tsx
const COLORS_DARK = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
const COLORS_LIGHT = ['#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed'];

const colors = theme === 'dark' ? COLORS_DARK : COLORS_LIGHT;
```

---

### Phase 4: Testing & Polish (30 min)

**Goal:** Verify all components in both themes

#### 4.1 Manual Testing Checklist

- [ ] Toggle theme button works
- [ ] Theme persists after reload
- [ ] All select dropdowns readable
- [ ] Dashboard cards properly styled
- [ ] Transaction table readable
- [ ] Filters panel usable
- [ ] Charts visible and styled correctly
- [ ] Modal backgrounds appropriate
- [ ] No flash of unstyled content (FOUC)
- [ ] Smooth theme transitions

#### 4.2 Screenshot Comparison

Take screenshots of:
1. Dashboard (light vs dark)
2. Transactions page (light vs dark)
3. Transaction detail modal (light vs dark)
4. Charts (light vs dark)

#### 4.3 Browser Testing

- [ ] Chrome/Edge (Tauri WebView)
- [ ] Check contrast ratios (WCAG AA compliance)
- [ ] Verify no CSS conflicts

---

## 📁 Files to Modify

### CSS Files (2)
1. ✏️ `src/styles/globals.css` - Add light mode colors, fix select color-scheme

### Component Files (~15)
2. ✏️ `src/components/layout/AppLayout.tsx`
3. ✏️ `src/pages/Dashboard.tsx`
4. ✏️ `src/pages/Transactions.tsx`
5. ✏️ `src/components/ui/Modal.tsx`
6. ✏️ `src/components/table/DataTable.tsx`
7. ✏️ `src/components/table/VirtualDataTable.tsx`
8. ✏️ `src/components/table/TableRow.tsx`
9. ✏️ `src/components/filters/FilterPanel.tsx`
10. ✏️ `src/components/transactions/StatsBar.tsx`
11. ✏️ `src/components/transactions/TransactionCharts.tsx`
12. ✏️ `src/components/transactions/BulkActionsToolbar.tsx`
13. ✏️ `src/components/transactions/TransactionDetailModal.tsx`
14. ✏️ `src/components/transactions/ExportMenu.tsx`
15. ✏️ `src/components/filters/DateRangeFilter.tsx`
16. ✏️ `src/components/filters/AmountRangeFilter.tsx`

### Utility Files (Optional)
17. ✏️ `src/lib/theme-utils.ts` - Helper for dynamic styles (if needed)

---

## 🎨 Color Scheme Reference

### Light Mode Palette
```css
Background Primary:   #ffffff    (white)
Background Secondary: #f8fafc    (slate-50)
Background Card:      #ffffff    (white)
Text Primary:         #0f172a    (slate-900)
Text Secondary:       #475569    (slate-600)
Border:               #e2e8f0    (slate-200)
Accent:               #eab308    (yellow-500)
```

### Dark Mode Palette (Current)
```css
Background Primary:   #0f172a    (slate-900)
Background Secondary: #1e293b    (slate-800)
Background Card:      #1e293b    (slate-800)
Text Primary:         #f8fafc    (slate-50)
Text Secondary:       #94a3b8    (slate-400)
Border:               #334155    (slate-700)
Accent:               #eab308    (yellow-500)
```

### Color Mapping Chart

| Element Type | Dark Mode | Light Mode |
|-------------|-----------|------------|
| Page BG | `bg-slate-900` | `bg-white` |
| Card BG | `bg-slate-800` | `bg-white` |
| Input BG | `bg-slate-700` | `bg-slate-50` |
| Text Primary | `text-slate-100` | `text-slate-900` |
| Text Secondary | `text-slate-400` | `text-slate-600` |
| Border | `border-slate-700` | `border-slate-200` |
| Hover BG | `hover:bg-slate-700` | `hover:bg-slate-100` |

---

## 🚀 Implementation Order

### Step 1: CSS Foundation (Start Here)
1. Update `globals.css` with light mode variables
2. Fix `select { color-scheme }` issue
3. Add `.light` class support for selects

**Test:** Toggle theme, check select dropdowns

### Step 2: Layout Components
4. Update `AppLayout.tsx` (sidebar, main)
5. Update main page backgrounds

**Test:** Toggle theme, verify page backgrounds

### Step 3: Dashboard
6. Update `Dashboard.tsx` cards
7. Update KPI cards
8. Update Investment/Balance cards

**Test:** Dashboard looks good in both themes

### Step 4: Transactions Page
9. Update `Transactions.tsx` main layout
10. Update `DataTable.tsx` and `VirtualDataTable.tsx`
11. Update `TableRow.tsx`
12. Update `FilterPanel.tsx`
13. Update `StatsBar.tsx`

**Test:** Transactions page fully functional in light mode

### Step 5: Charts & Modals
14. Update `TransactionCharts.tsx` with theme-aware styling
15. Update `TransactionDetailModal.tsx`
16. Update `ExportMenu.tsx`

**Test:** All interactions work in both themes

### Step 6: Final Polish
17. Verify all inputs/selects
18. Check contrast ratios
19. Test theme toggle multiple times
20. Check for FOUC on load

**Test:** Full app walkthrough in both themes

---

## 🧪 Testing Strategy

### Automated Testing (Optional)
```bash
# Check for hard-coded dark classes
grep -r "bg-slate-800" src/components --include="*.tsx" | grep -v "dark:"

# Check for hard-coded light text
grep -r "text-slate-100" src/components --include="*.tsx" | grep -v "dark:"
```

### Manual Testing Flows

**Flow 1: Basic Toggle**
1. Open app in dark mode (default)
2. Click theme toggle
3. Verify: All elements switch to light colors
4. Reload page
5. Verify: Light mode persists

**Flow 2: Component Tour (Dark)**
1. Dashboard → verify cards
2. Transactions → verify table
3. Open filter panel → verify inputs
4. Select transaction → verify modal
5. Export menu → verify dropdown

**Flow 3: Component Tour (Light)**
- Repeat Flow 2 in light mode

**Flow 4: Edge Cases**
1. Toggle theme with modal open
2. Toggle theme with dropdown open
3. Toggle theme while filtering
4. Toggle theme while charts render

---

## 📊 Success Criteria

### Must Have ✅
- [ ] All select elements readable in light mode
- [ ] Dashboard fully functional in light mode
- [ ] Transaction table readable in light mode
- [ ] No dark backgrounds in light mode (except intentional)
- [ ] Theme toggle works reliably
- [ ] Theme persists across sessions

### Should Have 🎯
- [ ] Smooth theme transitions (CSS transitions)
- [ ] Charts adapt colors to theme
- [ ] Modal overlays adjust opacity
- [ ] Contrast ratios meet WCAG AA
- [ ] No FOUC on page load

### Nice to Have 🌟
- [ ] System theme detection (`prefers-color-scheme`)
- [ ] Per-component theme override ability
- [ ] Theme preview before applying
- [ ] Animated theme toggle icon

---

## 🐛 Known Challenges

### Challenge 1: Recharts Styling
**Issue:** Recharts uses inline styles that don't respond to CSS classes  
**Solution:** Pass dynamic `contentStyle` props based on `theme` from context

### Challenge 2: Tailwind Class Conflicts
**Issue:** Existing classes may conflict with new `dark:` variants  
**Solution:** Use base class for light mode, `dark:` for dark mode overrides

### Challenge 3: Select Element Limitations
**Issue:** Native select styling is limited  
**Solution:** Use `color-scheme` CSS property for basic theming

### Challenge 4: Component Count
**Issue:** Many components need updates  
**Solution:** Start with high-impact components, iterate gradually

---

## 🎯 Estimated Impact

### User Experience
- **Current:** Dark mode only, light mode barely usable
- **After Fix:** Full light/dark theme parity, user choice respected

### Code Quality
- **Current:** Hard-coded colors, poor maintainability
- **After Fix:** Proper Tailwind variants, theme-aware components

### Accessibility
- **Current:** Light mode contrast issues
- **After Fix:** WCAG AA compliant in both themes

---

## 📋 Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Create feature branch** - `git checkout -b feat/light-mode-fix`
3. **Phase 1 implementation** - CSS foundation
4. **Incremental commits** - One phase per commit
5. **Test thoroughly** - All components in both themes
6. **Create PR** - Request review
7. **Merge to main** - Deploy fix

---

## 🔗 References

- [Tailwind Dark Mode Docs](https://tailwindcss.com/docs/dark-mode)
- [CSS color-scheme Property](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [Recharts Theming](https://recharts.org/en-US/guide/theming)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

**Status:** 📋 Ready for implementation  
**Assignee:** To be assigned  
**Labels:** `enhancement`, `ui`, `theme`, `accessibility`

---

*Created: 2026-06-27*  
*Last Updated: 2026-06-27*
