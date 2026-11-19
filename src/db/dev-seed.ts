/**
 * Dev-only seed: pre-creates password, a demo account, fiscal years, and
 * imports two years of SYNTHETIC transactions (see synthetic-seed.ts).
 * No real personal data lives in this repository.
 *
 * Default password: testtest
 */
import { invoke } from '@tauri-apps/api/core';
import { setPasswordHash } from './auth';
import { getFirstAccount, createAccount, createFiscalYear, getFiscalYears } from './accounts';
import { getDb } from './client';
import { dedupKey } from '../lib/utils';
import { generateSyntheticSeed, DEMO_ACCOUNT_NUMBER, type SeedStructure } from './synthetic-seed';

export async function devSeedAuth(): Promise<void> {
  try {
    // Seed password - always reset to testtest in dev mode
    if (import.meta.env.DEV) console.log('[dev-seed] Starting password setup...');
    const hash = await invoke<string>('hash_password', { password: 'testtest' });
    await setPasswordHash(hash);
    if (import.meta.env.DEV) console.log('[dev-seed] ✅ Password set to "testtest"');
  } catch (err) {
    if (import.meta.env.DEV) console.error('[dev-seed] ❌ Failed to set password:', err);
    throw err;
  }

  try {
    // Seed account
    let account = await getFirstAccount();
    if (!account) {
      const id = await createAccount({
        name: 'Compte Courant',
        bank_name: 'Crédit Agricole',
        account_number: DEMO_ACCOUNT_NUMBER,
      });
      account = { id, name: 'Compte Courant', bank_name: 'Crédit Agricole', account_number: DEMO_ACCOUNT_NUMBER, currency: 'EUR', is_active: true, created_at: '' };
      if (import.meta.env.DEV) console.log('[dev-seed] Account created');
    }

    // Seed fiscal years
    const data: SeedStructure = generateSyntheticSeed();
    const existingFYs = await getFiscalYears(account.id);

    for (const fy of data.fiscal_years) {
      const exists = existingFYs.find((e) => e.label === fy.label);
      if (!exists) {
        await createFiscalYear({
          account_id: account.id,
          label: fy.label,
          start_year: fy.start_year,
          start_month: fy.start_month,
          opening_balance: fy.opening_balance,
        });
        if (import.meta.env.DEV) console.log(`[dev-seed] Fiscal year ${fy.label} created`);
      }
    }

    // Seed transactions
    await seedTransactions(account.id, data);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[dev-seed] ❌ Failed to seed data:', err);
    // Don't throw - password is already set which is the critical part
  }
}

async function seedTransactions(accountId: number, data: SeedStructure): Promise<void> {
  const db = await getDb();

  // Check if already seeded
  const countRows = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM transactions');
  if ((countRows[0]?.n ?? 0) > 0) return;

  // Load fiscal years and categories
  const fys = await db.select<{ id: number; label: string }[]>(
    'SELECT id, label FROM fiscal_years WHERE account_id = ?', [accountId]
  );
  const fyMap = new Map(fys.map((f) => [f.label, f.id]));

  const categories = await db.select<{ id: number; slug: string }[]>('SELECT id, slug FROM categories');
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

  let total = 0;
  for (const [fyLabel, txList] of Object.entries(data.transactions)) {
    const fyId = fyMap.get(fyLabel);
    if (!fyId) continue;

    for (const tx of txList) {
      const amount = tx.debit ?? tx.credit ?? 0;
      const hash = dedupKey(tx.date, tx.label, amount);
      const categoryId = tx.category_slug ? slugToId.get(tx.category_slug) ?? null : null;

      try {
        await db.execute(
          `INSERT OR IGNORE INTO transactions
            (account_id, fiscal_year_id, date, label, debit, credit,
             category_id, is_reviewed, dedup_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [accountId, fyId, tx.date, tx.label, tx.debit, tx.credit, categoryId, hash]
        );
        total++;
      } catch {
        // Skip duplicates
      }
    }
  }

  if (import.meta.env.DEV) console.log(`[dev-seed] Imported ${total} transactions`);
}
