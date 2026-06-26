import { useQuery } from '@tanstack/react-query';
import { computeCurrentBalance } from '../db/balance';

export function useCurrentBalance() {
  return useQuery({
    queryKey: ['balance', 'current'],
    queryFn: computeCurrentBalance,
    // Refetch when transactions change — the query key ['balance'] is
    // invalidated by transaction mutations via the shared queryClient.
  });
}
