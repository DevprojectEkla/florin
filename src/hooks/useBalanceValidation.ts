import { useEffect, useState } from 'react';

export interface BalanceCheckpoint {
  date: string;
  expected: number;
  calculated: number;
  discrepancy: number;
  source: string;
}

/**
 * Hook to validate balance against known bank statement checkpoints.
 * 
 * This ensures the calculated balance matches the actual bank balance
 * at specific dates (from CA imports).
 */
export function useBalanceValidation() {
  const [checkpoints, setCheckpoints] = useState<BalanceCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadValidation();
  }, []);

  async function loadValidation() {
    try {
      setLoading(true);
      // Call the Rust backend to get validation checkpoints
      // For now, we'll use the TypeScript implementation
      const { validateBalanceCheckpoints } = await import('../db/balance');
      const result = await validateBalanceCheckpoints();
      setCheckpoints(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate balance');
    } finally {
      setLoading(false);
    }
  }

  const hasDiscrepancies = checkpoints.some((cp) => Math.abs(cp.discrepancy) > 0.01);
  const maxDiscrepancy = Math.max(...checkpoints.map((cp) => Math.abs(cp.discrepancy)), 0);

  return {
    checkpoints,
    loading,
    error,
    hasDiscrepancies,
    maxDiscrepancy,
    reload: loadValidation,
  };
}
