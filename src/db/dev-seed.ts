/**
 * Dev-only seed: pre-creates password, account, fiscal year, and imports
 * the full 2025-2026 transaction history from the ODS export.
 *
 * Default password: testtest
 *
 * This module is only imported in dev mode.
 */
import { invoke } from '@tauri-apps/api/core';
import { getPasswordHash, setPasswordHash } from './auth';
import { isOnboardingComplete, createAccount, createFiscalYear, getFirstAccount, getActiveFiscalYear } from './accounts';
import { getDb } from './client';
import { dedupKey } from '../lib/utils';
import seedData from './seed-data.json';

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
    await createFiscalYear({
      account_id: accountId,
      label: '2025-2026',
      start_year: 2025,
      start_month: 9,
      opening_balance: 1032.86,
    });
    if (import.meta.env.DEV) {
      console.log('[dev-seed] Account + fiscal year created');
    }
  }

  // Seed transactions from ODS export
  await seedTransactions();
}

async function seedTransactions(): Promise<void> {
  const db = await getDb();

  // Check if we already have transactions
  const countRows = await db.select<{ n: number }[]>(
    'SELECT COUNT(*) as n FROM transactions'
  );
  if ((countRows[0]?.n ?? 0) > 0) return; // Already seeded

  const account = await getFirstAccount();
  const fiscalYear = account ? await getActiveFiscalYear(account.id) : null;
  if (!account || !fiscalYear) return;

  // Load category slug -> id map
  const categories = await db.select<{ id: number; slug: string }[]>(
    'SELECT id, slug FROM categories'
  );
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

  let imported = 0;
  for (const tx of seedData as Array<{
    date: string; label: string;
    debit: number | null; credit: number | null;
    category_slug: string | null;
  }>) {
    const amount = tx.debit ?? tx.credit ?? 0;
    const hash = dedupKey(tx.date, tx.label, amount);
    const categoryId = tx.category_slug ? slugToId.get(tx.category_slug) ?? null : null;

    try {
      await db.execute(
        `INSERT OR IGNORE INTO transactions
          (account_id, fiscal_year_id, date, label, debit, credit,
           category_id, is_reviewed, dedup_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          account.id, fiscalYear.id,
          tx.date, tx.label,
          tx.debit, tx.credit,
          categoryId, hash,
        ]
      );
      imported++;
    } catch {
      // Skip duplicates silently
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[dev-seed] Imported ${imported} transactions from ODS data`);
  }
}
