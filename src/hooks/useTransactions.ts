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
  fiscalYearId: number | undefined,
  opts?: { month?: number; year?: number; categoryId?: number; unclassifiedOnly?: boolean }
) {
  return useQuery({
    queryKey: ['transactions', fiscalYearId, opts],
    queryFn: () => getTransactions(fiscalYearId!, opts),
    enabled: !!fiscalYearId,
  });
}

export function useTransactionCount(fiscalYearId: number | undefined) {
  return useQuery({
    queryKey: ['transactions', 'count', fiscalYearId],
    queryFn: () => getTransactionCount(fiscalYearId!),
    enabled: !!fiscalYearId,
  });
}

export function useUnclassifiedCount(fiscalYearId: number | undefined) {
  return useQuery({
    queryKey: ['transactions', 'unclassified', fiscalYearId],
    queryFn: () => getUnclassifiedCount(fiscalYearId!),
    enabled: !!fiscalYearId,
  });
}

export function useMonthlyAggregates(fiscalYearId: number | undefined) {
  return useQuery({
    queryKey: ['aggregates', 'monthly', fiscalYearId],
    queryFn: () => getMonthlyAggregates(fiscalYearId!),
    enabled: !!fiscalYearId,
  });
}

export function useCategoryAggregates(
  fiscalYearId: number | undefined,
  year?: number,
  month?: number
) {
  return useQuery({
    queryKey: ['aggregates', 'category', fiscalYearId, year, month],
    queryFn: () => getCategoryAggregates(fiscalYearId!, year, month),
    enabled: !!fiscalYearId,
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
    },
  });
}
