import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../../store/FiscalYearContext';
import { useViewMonth } from '../../store/MonthContext';
import { useTheme } from '../../store/ThemeContext';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: '◉',  key: 'nav.dashboard'    },
  { to: '/transactions', icon: '↕',  key: 'nav.transactions' },
  { to: '/import',       icon: '📥', key: 'nav.import'       },
  { to: '/budget',       icon: '◎',  key: 'nav.budget'       },
  { to: '/investments',  icon: '↗',  key: 'nav.investments'  },
  { to: '/settings',     icon: '⚙',  key: 'nav.settings'     },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { allFiscalYears, selected: fiscalYear, selectedId, setSelectedId } = useFiscalYear();
  const { viewYear, viewMonth, setViewMonth } = useViewMonth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Pages that show month-level data and benefit from the month selector
  const monthAwareRoutes = ['/dashboard', '/budget', '/transactions'];
  const showMonthSelector = monthAwareRoutes.some(r => location.pathname.startsWith(r))
    && selectedId !== null; // hide in "all years" mode

  // Build month options for the selected fiscal year (or current year if none)
  const monthOptions: { year: number; month: number }[] = [];
  if (fiscalYear) {
    for (let i = 0; i < 13; i++) { // up to 13 months to handle overflow
      let m = fiscalYear.start_month + i;
      let y = fiscalYear.start_year;
      if (m > 12) { m -= 12; y++; }
      monthOptions.push({ year: y, month: m });
      // Stop once we've covered a full year
      if (i >= 11) break;
    }
  } else {
    // Fallback: current calendar year
    const now = new Date();
    for (let m = 1; m <= 12; m++) {
      monthOptions.push({ year: now.getFullYear(), month: m });
    }
  }



  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-700">
          <span className="text-florin-400 text-2xl font-bold">ƒ</span>
          <span className="text-slate-100 text-xl font-semibold ml-1">lorin</span>
        </div>

        {/* Fiscal Year Selector */}
        <div className="px-3 py-3 border-b border-slate-700">
          <select
            className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-florin-400`}
            style={
              theme === 'light'
                ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                : { backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#475569' }
            }
            value={selectedId ?? 'all'}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedId(val === 'all' ? null : parseInt(val));
            }}
          >
            <option value="all">{t('fiscal_year.all_years')}</option>
            {allFiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.label}</option>
            ))}
          </select>
        </div>

        {/* Month Selector — visible on dashboard, budget, transactions */}
        {showMonthSelector && (
          <div className="px-3 py-2.5 border-b border-slate-700">
            <select
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-florin-400"
              style={
                theme === 'light'
                  ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                  : { backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#475569' }
              }
              value={`${viewYear}-${String(viewMonth).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                setViewMonth(y, m);
              }}
            >
              {monthOptions.map(({ year, month }) => (
                <option key={`${year}-${month}`} value={`${year}-${String(month).padStart(2, '0')}`}>
                  {t(`months.${month}`)} {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ` +
                (isActive
                  ? 'bg-florin-500/10 text-florin-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800')
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Version + Theme Toggle */}
        <div className="px-3 py-3 border-t border-slate-700 flex items-center justify-between">
          <span className="text-slate-600 text-xs">v0.1.0</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
            title={theme === 'dark' ? t('theme.switch_to_light') : t('theme.switch_to_dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        {children}
      </main>
    </div>
  );
}
