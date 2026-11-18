import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../db/client';
import { checkForUpdate } from '../lib/updater';

const AUTO_CHECK_KEY = 'auto_update_check';

async function getAutoCheck(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM app_settings WHERE key = ?',
    [AUTO_CHECK_KEY]
  );
  // On by default; only an explicit "0" turns it off
  return rows[0]?.value !== '0';
}

export function useAutoUpdateCheck() {
  return useQuery({ queryKey: ['settings', AUTO_CHECK_KEY], queryFn: getAutoCheck });
}

export function useSetAutoUpdateCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const db = await getDb();
      await db.execute('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
        AUTO_CHECK_KEY,
        enabled ? '1' : '0',
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', AUTO_CHECK_KEY] }),
  });
}

/**
 * Shared update check. Runs once at launch (production builds, unless the
 * user turned it off) and can be re-run from Settings with refetch().
 * Network failures are swallowed into `error` — an unreachable GitHub must
 * never get in the way of using the app.
 */
export function useUpdateCheck() {
  const { data: autoCheck } = useAutoUpdateCheck();
  return useQuery({
    queryKey: ['update-check'],
    queryFn: checkForUpdate,
    enabled: !import.meta.env.DEV && autoCheck === true,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
