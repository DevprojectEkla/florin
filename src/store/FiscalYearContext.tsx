import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveFiscalYear } from '../hooks/useAccounts';
import { useActiveAccount } from './AccountContext';
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
  const { activeAccountId } = useActiveAccount();
  const { data: latestFy } = useActiveFiscalYear(activeAccountId);
  const { data: allFYs = [] } = useQuery({
    queryKey: ['fiscal-years', activeAccountId],
    queryFn: () => getFiscalYears(activeAccountId!),
    enabled: !!activeAccountId,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Account for which the default fiscal year has already been chosen
  const [initializedFor, setInitializedFor] = useState<number | undefined>(undefined);

  // Default to the latest FY on first load and whenever the account changes.
  // `latestFy === undefined` means "still loading"; `null` means "no FY yet".
  useEffect(() => {
    if (activeAccountId === undefined || latestFy === undefined) return;
    if (initializedFor !== activeAccountId) {
      setSelectedId(latestFy?.id ?? null);
      setInitializedFor(activeAccountId);
    }
  }, [latestFy, activeAccountId, initializedFor]);

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
