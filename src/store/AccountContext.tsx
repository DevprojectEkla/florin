import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../db/accounts';
import { getDb } from '../db/client';
import type { Account } from '../types';

const ACTIVE_ACCOUNT_KEY = 'active_account_id';

interface AccountContextValue {
  accounts: Account[];
  /** The account every page is currently scoped to (null until loaded). */
  activeAccount: Account | null;
  activeAccountId: number | undefined;
  setActiveAccountId: (id: number) => Promise<void>;
}

const AccountCtx = createContext<AccountContextValue>({
  accounts: [],
  activeAccount: null,
  activeAccountId: undefined,
  setActiveAccountId: async () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });
  const [savedId, setSavedId] = useState<number | null>(null);

  // Restore the last selected account
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM app_settings WHERE key = ?',
        [ACTIVE_ACCOUNT_KEY]
      );
      const parsed = rows[0] ? parseInt(rows[0].value, 10) : NaN;
      if (!cancelled && !Number.isNaN(parsed)) setSavedId(parsed);
    })();
    return () => { cancelled = true; };
  }, []);

  // Fall back to the first account if the saved one is gone or unset
  const activeAccount = accounts.find((a) => a.id === savedId) ?? accounts[0] ?? null;

  const setActiveAccountId = useCallback(async (id: number) => {
    setSavedId(id);
    const db = await getDb();
    await db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [ACTIVE_ACCOUNT_KEY, String(id)]
    );
  }, []);

  return (
    <AccountCtx.Provider
      value={{
        accounts,
        activeAccount,
        activeAccountId: activeAccount?.id,
        setActiveAccountId,
      }}
    >
      {children}
    </AccountCtx.Provider>
  );
}

export function useActiveAccount() {
  return useContext(AccountCtx);
}
