import { createContext, useContext, useState, type ReactNode } from 'react';

interface MonthContextValue {
  viewYear: number;
  viewMonth: number;
  setViewMonth: (year: number, month: number) => void;
}

const MonthCtx = createContext<MonthContextValue>({
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth() + 1,
  setViewMonth: () => {},
});

export function MonthProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [viewYear, setYear]   = useState(now.getFullYear());
  const [viewMonth, setMonth] = useState(now.getMonth() + 1);

  function setViewMonth(year: number, month: number) {
    setYear(year);
    setMonth(month);
  }

  return (
    <MonthCtx.Provider value={{ viewYear, viewMonth, setViewMonth }}>
      {children}
    </MonthCtx.Provider>
  );
}

export function useViewMonth() {
  return useContext(MonthCtx);
}
