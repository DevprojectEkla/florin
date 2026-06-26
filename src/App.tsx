import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getDb } from './db/client';
import AppLayout from './components/layout/AppLayout';
import LockScreen from './pages/LockScreen';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
import Investments from './pages/Investments';
import Settings from './pages/Settings';

type AppState = 'loading' | 'setup' | 'locked' | 'unlocked';

export default function App() {
  const [state, setState] = useState<AppState>('loading');

  useEffect(() => {
    async function init() {
      try {
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
        // Check if password is set
        const rows = await db.select<{ value: string }[]>(
          "SELECT value FROM app_settings WHERE key = 'password_hash'"
        );
        if (rows.length === 0) {
          setState('setup');
        } else {
          setState('locked');
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('DB init error', e);
        setState('setup');
      }
    }
    init();
  }, []);

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
        onUnlocked={() => setState('unlocked')}
      />
    );
  }

  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/"              element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/transactions"  element={<Transactions />} />
          <Route path="/budget"        element={<Budget />} />
          <Route path="/investments"   element={<Investments />} />
          <Route path="/settings"      element={<Settings />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  );
}
