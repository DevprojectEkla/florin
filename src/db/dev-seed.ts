/**
 * Dev-only seed: pre-creates a password and account/fiscal year so the
 * lock screen and onboarding wizard are auto-bypassed during development.
 *
 * Default password: testtest
 *
 * This module is only imported in dev mode.
 */
import { invoke } from '@tauri-apps/api/core';
import { getPasswordHash, setPasswordHash } from './auth';
import { isOnboardingComplete, createAccount, createFiscalYear } from './accounts';

export async function devSeedAuth(): Promise<void> {
  // Seed password
  const existing = await getPasswordHash();
  if (!existing) {
    const DEV_PASSWORD = 'testtest';
    const hash = await invoke<string>('hash_password', { password: DEV_PASSWORD });
    await setPasswordHash(hash);
    if (import.meta.env.DEV) {
      console.log('[dev-seed] Password set to "testtest"');
    }
  }

  // Seed account + fiscal year
  const onboarded = await isOnboardingComplete();
  if (!onboarded) {
    const accountId = await createAccount({
      name: 'Compte Courant',
      bank_name: 'Crédit Agricole',
      account_number: '00012345678',
    });
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
    await createFiscalYear({
      account_id: accountId,
      label: `${startYear}-${startYear + 1}`,
      start_year: startYear,
      start_month: 9,
      opening_balance: 1032.86,
    });
    if (import.meta.env.DEV) {
      console.log('[dev-seed] Account + fiscal year created');
    }
  }
}
