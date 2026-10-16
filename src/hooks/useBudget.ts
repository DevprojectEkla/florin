import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBudgetLines,
  getBudgetComparison,
  getBudgetSummary,
  upsertBudgetLine,
  setBudgetBatch,
  computeAveragesFromHistory,
} from '../db/budget';

export function useBudgetLines(fiscalYearId: number | undefined) {
  return useQuery({
    queryKey: ['budget', 'lines', fiscalYearId],
    queryFn: () => getBudgetLines(fiscalYearId!),
    enabled: !!fiscalYearId,
  });
}

export function useBudgetComparison(fiscalYearId: number | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['budget', 'comparison', fiscalYearId, year, month],
    queryFn: () => getBudgetComparison(fiscalYearId!, year, month),
    enabled: !!fiscalYearId,
  });
}

export function useBudgetSummary(fiscalYearId: number | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['budget', 'summary', fiscalYearId, year, month],
    queryFn: () => getBudgetSummary(fiscalYearId!, year, month),
    enabled: !!fiscalYearId,
  });
}

export function useUpsertBudgetLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fiscalYearId, categoryId, amount }: {
      fiscalYearId: number; categoryId: number; amount: number;
    }) => upsertBudgetLine(fiscalYearId, categoryId, amount),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); },
  });
}

export function useSetBudgetBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fiscalYearId, lines }: {
      fiscalYearId: number;
      lines: { categoryId: number; amount: number; minAmount?: number | null; maxAmount?: number | null }[];
    }) => setBudgetBatch(fiscalYearId, lines),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); },
  });
}

export function useComputeAverages() {
  return useMutation({
    mutationFn: (fiscalYearId: number) => computeAveragesFromHistory(fiscalYearId),
  });
}
