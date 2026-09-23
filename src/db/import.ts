import { getDb } from './client';
import { dedupKey } from '../lib/utils';
import { resolveFiscalYearForDate } from './accounts';
import type { ParsedImport } from '../lib/ca-parser';

export interface ImportResult {
  batchId: number;
  imported: number;
  skipped: number;
  conflicted: number;
}

/**
 * Import parsed transactions into the DB.
 * - Generates dedup hashes
 * - Skips duplicates silently
 * - Applies classification rules
 * - Creates import batch record
 */
export async function importTransactions(
  parsed: ParsedImport,
  accountId: number,
  fiscalYearId: number
): Promise<ImportResult> {
  const db = await getDb();

  // 1. Create import batch
  const batchResult = await db.execute(
    `INSERT INTO import_batches
      (account_id, fiscal_year_id, filename, account_number_raw,
       balance_at_import, period_from, period_to, rows_in_file,
       rows_imported, rows_skipped, rows_conflicted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    [
      accountId, fiscalYearId, parsed.filename,
      parsed.accountNumber, parsed.balanceAtImport,
      parsed.periodFrom, parsed.periodTo,
      parsed.transactions.length,
    ]
  );
  const batchId = batchResult.lastInsertId as number;

  // 2. Load classification rules
  const rules = await db.select<{
    id: number; pattern: string; pattern_type: string;
    category_id: number; priority: number;
  }[]>(
    `SELECT id, pattern, pattern_type, category_id, priority
     FROM classification_rules
     WHERE is_active = 1
     ORDER BY priority DESC`
  );

  // 3. Process each transaction
  let imported = 0;
  let skipped = 0;

  // Track how many times each base hash appears in this file so that
  // legitimate duplicate purchases (same day, same label, same amount)
  // are not incorrectly deduplicated against each other.
  const hashCountInFile = new Map<string, number>();

  for (const tx of parsed.transactions) {
    const amount = tx.debit ?? tx.credit ?? 0;
    const baseHash = generateHash(tx.date, tx.label, amount);

    // Increment occurrence counter for this file
    const occurrence = (hashCountInFile.get(baseHash) ?? 0) + 1;
    hashCountInFile.set(baseHash, occurrence);

    // Qualify the hash with the occurrence index so that the 2nd, 3rd…
    // identical transaction in the same file gets a distinct hash.
    const hash = occurrence > 1 ? `${baseHash}#${occurrence}` : baseHash;

    // Check for duplicate against already-stored transactions
    const existing = await db.select<{ id: number }[]>(
      'SELECT id FROM transactions WHERE dedup_hash = ?',
      [hash]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Classify
    const categoryId = classifyTransaction(tx.label, rules);

    // Resolve the fiscal year for THIS transaction's date, creating a new one
    // if the date falls outside all existing fiscal years (e.g. new year starts).
    const txFiscalYear = await resolveFiscalYearForDate(accountId, tx.date);

    // Insert
    await db.execute(
      `INSERT INTO transactions
        (account_id, fiscal_year_id, import_batch_id, date, label,
         debit, credit, category_id, is_reviewed, dedup_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountId, txFiscalYear.id, batchId,
        tx.date, tx.label,
        tx.debit, tx.credit,
        categoryId,
        0, // is_reviewed: user confirms later
        hash,
      ]
    );

    // Update rule match count
    if (categoryId) {
      const matchedRule = rules.find((r) => matchesPattern(tx.label, r.pattern, r.pattern_type));
      if (matchedRule) {
        await db.execute(
          'UPDATE classification_rules SET match_count = match_count + 1 WHERE id = ?',
          [matchedRule.id]
        );
      }
    }

    imported++;
  }

  // 4. Update batch stats
  await db.execute(
    `UPDATE import_batches
     SET rows_imported = ?, rows_skipped = ?, rows_conflicted = 0
     WHERE id = ?`,
    [imported, skipped, batchId]
  );

  return { batchId, imported, skipped, conflicted: 0 };
}

// ─── Classification ──────────────────────────────────────────────────────────

function classifyTransaction(
  label: string,
  rules: { pattern: string; pattern_type: string; category_id: number }[]
): number | null {
  for (const rule of rules) {
    if (matchesPattern(label, rule.pattern, rule.pattern_type)) {
      return rule.category_id;
    }
  }
  return null;
}

function matchesPattern(label: string, pattern: string, type: string): boolean {
  const upperLabel = label.toUpperCase();
  const upperPattern = pattern.toUpperCase();

  switch (type) {
    case 'contains':
      return upperLabel.includes(upperPattern);
    case 'starts_with':
      return upperLabel.startsWith(upperPattern);
    case 'regex':
      try {
        return new RegExp(pattern, 'i').test(label);
      } catch {
        return false;
      }
    default:
      return upperLabel.includes(upperPattern);
  }
}

// ─── Dedup hash ──────────────────────────────────────────────────────────────

function generateHash(date: string, label: string, amount: number): string {
  // Use the dedupKey as the hash directly — it's unique enough for this volume
  // In the future, we could SHA-256 this for fixed-length keys
  return dedupKey(date, label, amount);
}
