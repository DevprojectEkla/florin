import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../../store/FiscalYearContext';
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
  const { allFiscalYears, selectedId, setSelectedId } = useFiscalYear();
  const { theme, toggleTheme } = useTheme();

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
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm
                       text-slate-200 focus:outline-none focus:ring-1 focus:ring-florin-400
                       [&>option]:bg-slate-800 [&>option]:text-slate-200"
            value={selectedId ?? 'all'}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedId(val === 'all' ? null : parseInt(val));
            }}
          >
            <option value="all" className="bg-slate-800 text-slate-200">{t('fiscal_year.all_years')}</option>
            {allFiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id} className="bg-slate-800 text-slate-200">{fy.label}</option>
            ))}
          </select>
        </div>

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
