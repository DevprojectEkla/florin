import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransactions,
  getTransactionCount,
  getUnclassifiedCount,
  getMonthlyAggregates,
  getCategoryAggregates,
  updateTransactionCategory,
} from '../db/transactions';

export function useTransactions(
  fiscalYearId: number | null | undefined,
  opts?: { month?: number; year?: number; categoryId?: number; unclassifiedOnly?: boolean }
) {
  return useQuery({
    queryKey: ['transactions', fiscalYearId, opts],
    queryFn: () => getTransactions(fiscalYearId ?? null, opts),
    enabled: fiscalYearId !== undefined,
  });
}

export function useTransactionCount(fiscalYearId: number | null | undefined) {
  return useQuery({
    queryKey: ['transactions', 'count', fiscalYearId],
    queryFn: () => getTransactionCount(fiscalYearId ?? null),
    enabled: fiscalYearId !== undefined,
  });
}

export function useUnclassifiedCount(fiscalYearId: number | null | undefined) {
  return useQuery({
    queryKey: ['transactions', 'unclassified', fiscalYearId],
    queryFn: () => getUnclassifiedCount(fiscalYearId ?? null),
    enabled: fiscalYearId !== undefined,
  });
}

export function useMonthlyAggregates(fiscalYearId: number | null | undefined) {
  return useQuery({
    queryKey: ['aggregates', 'monthly', fiscalYearId],
    queryFn: () => getMonthlyAggregates(fiscalYearId ?? null),
    enabled: fiscalYearId !== undefined,
  });
}

export function useCategoryAggregates(
  fiscalYearId: number | null | undefined,
  year?: number,
  month?: number
) {
  return useQuery({
    queryKey: ['aggregates', 'category', fiscalYearId, year, month],
    queryFn: () => getCategoryAggregates(fiscalYearId ?? null, year, month),
    enabled: fiscalYearId !== undefined,
  });
}

export function useUpdateTransactionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number | null }) =>
      updateTransactionCategory(id, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['aggregates'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}
