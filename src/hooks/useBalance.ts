import { useQuery } from '@tanstack/react-query';
import { computeCurrentBalance } from '../db/balance';
import { useActiveAccount } from '../store/AccountContext';

export function useCurrentBalance() {
  const { activeAccountId } = useActiveAccount();
  return useQuery({
    queryKey: ['balance', 'current', activeAccountId],
    queryFn: () => computeCurrentBalance(activeAccountId),
    // Refetch when transactions change — the query key ['balance'] is
    // invalidated by transaction mutations via the shared queryClient.
  });
}
