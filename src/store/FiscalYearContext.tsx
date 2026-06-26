import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useFirstAccount, useActiveFiscalYear } from '../hooks/useAccounts';
import { getFiscalYears } from '../db/accounts';
import type { FiscalYear } from '../types';

interface FiscalYearContextValue {
  allFiscalYears: FiscalYear[];
  selected: FiscalYear | null;
  /** null means "all years" scope */
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
}

const FiscalYearCtx = createContext<FiscalYearContextValue>({
  allFiscalYears: [],
  selected: null,
  selectedId: null,
  setSelectedId: () => {},
});

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const { data: account } = useFirstAccount();
  const { data: latestFy } = useActiveFiscalYear(account?.id);
  const [allFYs, setAllFYs] = useState<FiscalYear[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Load all fiscal years
  useEffect(() => {
    if (!account) return;
    getFiscalYears(account.id).then(setAllFYs);
  }, [account]);

  // Default to latest FY
  useEffect(() => {
    if (selectedId === null && latestFy) {
      setSelectedId(latestFy.id);
    }
  }, [latestFy, selectedId]);

  const selected = allFYs.find((fy) => fy.id === selectedId) ?? null;

  return (
    <FiscalYearCtx.Provider value={{ allFiscalYears: allFYs, selected, selectedId, setSelectedId }}>
      {children}
    </FiscalYearCtx.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearCtx);
}
