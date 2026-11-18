import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getDb } from './db/client';
import { getPasswordHash } from './db/auth';
import { isOnboardingComplete } from './db/accounts';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { AccountProvider } from './store/AccountContext';
import { FiscalYearProvider } from './store/FiscalYearContext';
import { MonthProvider } from './store/MonthContext';
import { ThemeProvider } from './store/ThemeContext';
import LockScreen from './pages/LockScreen';
import OnboardingWizard from './pages/OnboardingWizard';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Import from './pages/Import';
import Budget from './pages/Budget';
import Investments from './pages/Investments';
import Settings from './pages/Settings';

type AppState = 'loading' | 'setup' | 'locked' | 'onboarding' | 'ready';

export default function App() {
  const [state, setState] = useState<AppState>('loading');

  useEffect(() => {
    async function init() {
      try {
        console.log('[App] Initializing... DEV mode:', import.meta.env.DEV);
        const db = await getDb();
        // Restore persisted language
        const langRows = await db.select<{ value: string }[]>(
          "SELECT value FROM app_settings WHERE key = 'default_language'"
        );
        if (langRows.length > 0 && langRows[0].value) {
          const { default: i18n } = await import('./lib/i18n');
          if (i18n.language !== langRows[0].value) {
            await i18n.changeLanguage(langRows[0].value);
          }
        }

        // Dev mode: seed default password and skip auth screens
        if (import.meta.env.DEV) {
          console.log('[App] DEV mode - running devSeedAuth');
          const { devSeedAuth } = await import('./db/dev-seed');
          await devSeedAuth();
          console.log('[App] devSeedAuth complete');
          
          // In dev mode, auto-unlock and check onboarding
          const complete = await isOnboardingComplete();
          setState(complete ? 'ready' : 'onboarding');
        } else {
          // Production: check if password is set
          const hash = await getPasswordHash();
          if (!hash) {
            setState('setup');
          } else {
            setState('locked');
          }
        }
      } catch (e) {
        console.error('[App] DB init error:', e);
        if (import.meta.env.DEV) console.error('DB init error', e);
        setState('setup');
      }
    }
    init();
  }, []);

  async function handleUnlocked() {
    // After unlocking, check if onboarding is done
    const complete = await isOnboardingComplete();
    setState(complete ? 'ready' : 'onboarding');
  }

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-florin-400 text-2xl font-semibold animate-pulse">florin</div>
      </div>
    );
  }

  if (state === 'setup' || state === 'locked') {
    return (
      <LockScreen
        mode={state}
        onUnlocked={handleUnlocked}
      />
    );
  }

  if (state === 'onboarding') {
    return <OnboardingWizard onComplete={() => setState('ready')} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <HashRouter>
          <AccountProvider>
          <FiscalYearProvider>
            <MonthProvider>
              <AppLayout>
                <Routes>
                  <Route path="/"              element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard"     element={<Dashboard />} />
                  <Route path="/transactions"  element={<Transactions />} />
                  <Route path="/import"        element={<Import />} />
                  <Route path="/budget"        element={<Budget />} />
                  <Route path="/investments"   element={<Investments />} />
                  <Route path="/settings"      element={<Settings />} />
                </Routes>
              </AppLayout>
            </MonthProvider>
          </FiscalYearProvider>
          </AccountProvider>
      </HashRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
