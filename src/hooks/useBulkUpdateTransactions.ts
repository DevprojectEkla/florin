import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTransactionCategory, deleteTransaction } from '../db/transactions';

export function useBulkUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: number[]; categoryId: number | null }) => {
      const results = await Promise.allSettled(
        ids.map(id => updateTransactionCategory(id, categoryId))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { succeeded, failed, total: ids.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useBulkDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map(id => deleteTransaction(id))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { succeeded, failed, total: ids.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
