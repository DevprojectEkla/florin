import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransactions,
  getTransactionCount,
  getUnclassifiedCount,
  getMonthlyAggregates,
  getCategoryAggregates,
  updateTransactionCategory,
  updateTransactionAttributedMonth,
  insertManualTransaction,
  deleteTransaction,
} from '../db/transactions';
import type { ManualTransactionInput } from '../db/transactions';
import { useActiveAccount } from '../store/AccountContext';

export function useTransactions(
  fiscalYearId: number | null | undefined,
  opts?: { month?: number; year?: number; categoryId?: number; unclassifiedOnly?: boolean }
) {
  const { activeAccountId } = useActiveAccount();
  const scoped = { ...opts, accountId: activeAccountId };
  return useQuery({
    queryKey: ['transactions', fiscalYearId, scoped],
    queryFn: () => getTransactions(fiscalYearId ?? null, scoped),
    enabled: fiscalYearId !== undefined,
  });
}

export function useTransactionCount(fiscalYearId: number | null | undefined) {
  const { activeAccountId } = useActiveAccount();
  return useQuery({
    queryKey: ['transactions', 'count', fiscalYearId, activeAccountId],
    queryFn: () => getTransactionCount(fiscalYearId ?? null, activeAccountId),
    enabled: fiscalYearId !== undefined,
  });
}

export function useUnclassifiedCount(fiscalYearId: number | null | undefined) {
  const { activeAccountId } = useActiveAccount();
  return useQuery({
    queryKey: ['transactions', 'unclassified', fiscalYearId, activeAccountId],
    queryFn: () => getUnclassifiedCount(fiscalYearId ?? null, activeAccountId),
    enabled: fiscalYearId !== undefined,
  });
}

export function useMonthlyAggregates(fiscalYearId: number | null | undefined) {
  const { activeAccountId } = useActiveAccount();
  return useQuery({
    queryKey: ['aggregates', 'monthly', fiscalYearId, activeAccountId],
    queryFn: () => getMonthlyAggregates(fiscalYearId ?? null, activeAccountId),
    enabled: fiscalYearId !== undefined,
  });
}

export function useCategoryAggregates(
  fiscalYearId: number | null | undefined,
  year?: number,
  month?: number
) {
  const { activeAccountId } = useActiveAccount();
  return useQuery({
    queryKey: ['aggregates', 'category', fiscalYearId, year, month, activeAccountId],
    queryFn: () => getCategoryAggregates(fiscalYearId ?? null, year, month, activeAccountId),
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

export function useInsertManualTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualTransactionInput) => insertManualTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['aggregates'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['aggregates'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUpdateAttributedMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, attributedMonth }: { id: number; attributedMonth: string | null }) =>
      updateTransactionAttributedMonth(id, attributedMonth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}
