/**
 * Dev-only seed: pre-creates a password so the lock screen
 * is auto-bypassed during development.
 *
 * Default password: testtest
 *
 * This module is only imported in dev mode.
 */
import { invoke } from '@tauri-apps/api/core';
import { getPasswordHash, setPasswordHash } from './auth';

export async function devSeedAuth(): Promise<void> {
  const existing = await getPasswordHash();
  if (existing) return; // Already set up — don't overwrite

  const DEV_PASSWORD = 'testtest';
  const hash = await invoke<string>('hash_password', { password: DEV_PASSWORD });
  await setPasswordHash(hash);

  if (import.meta.env.DEV) {
    console.log('[dev-seed] Password set to "testtest"');
  }
}
