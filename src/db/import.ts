import { getDb } from './client';
import { dedupKey } from '../lib/utils';
import { resolveFiscalYearForDate, getLegacyAccountId } from './accounts';
import { scopeDedupHash } from '../lib/accounts';
import { dateSpan, planImport, type DbTx, type ExtraRow } from '../lib/reconcile';
import { storeImportedFile } from '../lib/import-store';
import type { ParsedImport } from '../lib/ca-parser';

export interface ImportResult {
  batchId: number;
  imported: number;
  skipped: number;
  conflicted: number;
  /** Rows found in the file. */
  rowsInFile: number;
  /** First / last transaction date in the file. */
  periodFrom: string | null;
  periodTo: string | null;
  /** Rows the app holds for this account on that same period, after the import. */
  rowsInPeriod: number;
  /** App rows on the period that the file does not account for (to review). */
  extras: ExtraRow[];
  /** Relative path of the stored copy of the file, or null if it could not be saved. */
  storedPath: string | null;
}

export interface ImportOptions {
  /** Raw bytes of the source file; when given, a copy is kept in the app's import folder. */
  sourceBytes?: Uint8Array;
}

/**
 * Import parsed transactions into the DB.
 *
 * Reconciles by *count*: for each (date, label, amount) the app ends up with
 * exactly as many rows as the file, so overlapping files, re-imports and
 * deleted rows never produce duplicates. Rows the app holds on the file's
 * period that the file doesn't explain are returned as `extras`, never
 * deleted automatically.
 */
export async function importTransactions(
  parsed: ParsedImport,
  accountId: number,
  fiscalYearId: number,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const db = await getDb();
  const legacyAccountId = await getLegacyAccountId();
  const span = dateSpan(parsed.transactions);

  // 1. Create import batch
  const batchResult = await db.execute(
    `INSERT INTO import_batches
      (account_id, fiscal_year_id, filename, account_number_raw,
       balance_at_import, period_from, period_to, rows_in_file,
       rows_imported, rows_skipped, rows_conflicted, tx_from, tx_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
    [
      accountId, fiscalYearId, parsed.filename,
      parsed.accountNumber, parsed.balanceAtImport,
      parsed.periodFrom, parsed.periodTo,
      parsed.transactions.length,
      span?.from ?? null, span?.to ?? null,
    ]
  );
  const batchId = batchResult.lastInsertId as number;

  // 2. Keep a copy of the file so it stays inspectable. A storage failure must
  //    not block the import itself.
  let storedPath: string | null = null;
  if (options.sourceBytes) {
    try {
      storedPath = await storeImportedFile(accountId, parsed.filename, options.sourceBytes);
      await db.execute('UPDATE import_batches SET stored_path = ? WHERE id = ?', [storedPath, batchId]);
    } catch (e) {
      console.error('[import] could not store a copy of the file:', e);
    }
  }

  // 3. Load classification rules
  const rules = await db.select<{
    id: number; pattern: string; pattern_type: string;
    category_id: number; priority: number;
  }[]>(
    `SELECT id, pattern, pattern_type, category_id, priority
     FROM classification_rules
     WHERE is_active = 1
     ORDER BY priority DESC`
  );

  // 4. Compare the file with what the app already holds on the same period
  const dbRows: DbTx[] = span
    ? await db.select<DbTx[]>(
        `SELECT id, date, label, debit, credit, dedup_hash
         FROM transactions
         WHERE account_id = ? AND date BETWEEN ? AND ?`,
        [accountId, span.from, span.to]
      )
    : [];
  const plan = planImport(parsed.transactions, dbRows);

  // 5. Insert only what is missing
  const usedHashes = new Set<string>();
  let imported = 0;

  for (const tx of plan.toInsert) {
    const amount = tx.debit ?? tx.credit ?? 0;
    // Scope the hash per account so identical operations on two different
    // accounts don't collide on the global UNIQUE(dedup_hash) constraint.
    const baseHash = scopeDedupHash(
      dedupKey(tx.date, tx.label, amount),
      accountId,
      legacyAccountId
    );
    const hash = await nextFreeHash(baseHash, usedHashes);
    usedHashes.add(hash);

    const categoryId = classifyTransaction(tx.label, rules);

    // Resolve the fiscal year for THIS transaction's date, creating a new one
    // if the date falls outside all existing fiscal years (e.g. new year starts).
    const txFiscalYear = await resolveFiscalYearForDate(accountId, tx.date);

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

  // 6. Update batch stats
  await db.execute(
    `UPDATE import_batches
     SET rows_imported = ?, rows_skipped = ?, rows_conflicted = 0
     WHERE id = ?`,
    [imported, plan.skipped, batchId]
  );

  // 7. How many rows does the app now hold on the file's period?
  let rowsInPeriod = 0;
  if (span) {
    const rows = await db.select<{ n: number }[]>(
      'SELECT COUNT(*) as n FROM transactions WHERE account_id = ? AND date BETWEEN ? AND ?',
      [accountId, span.from, span.to]
    );
    rowsInPeriod = rows[0]?.n ?? 0;
  }

  return {
    batchId,
    imported,
    skipped: plan.skipped,
    conflicted: 0,
    rowsInFile: parsed.transactions.length,
    periodFrom: span?.from ?? null,
    periodTo: span?.to ?? null,
    rowsInPeriod,
    extras: plan.extras,
    storedPath,
  };
}

/**
 * dedup_hash is UNIQUE. Rows are matched by count (see planImport), so the
 * hash only has to be unique: take `base`, then `base#2`, `base#3`… until free.
 */
async function nextFreeHash(base: string, usedInThisRun: Set<string>): Promise<string> {
  const db = await getDb();
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}#${n}`;
    if (usedInThisRun.has(candidate)) continue;
    const rows = await db.select<{ id: number }[]>(
      'SELECT id FROM transactions WHERE dedup_hash = ?',
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
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
