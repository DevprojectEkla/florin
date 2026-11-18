/**
 * Import reconciliation (pure, no I/O).
 *
 * Instead of trusting per-row hashes (which break when a user deletes one of
 * two identical rows and re-imports), we compare *counts*: for every
 * (date, label, amount) the app must hold exactly as many rows as the file.
 * A file therefore inserts only what is missing, and anything the app holds
 * on the file's period that the file does not account for is reported.
 */

export interface FileTx {
  date: string; // YYYY-MM-DD
  label: string;
  debit: number | null;
  credit: number | null;
}

export interface DbTx {
  id: number;
  date: string;
  label: string;
  debit: number | null;
  credit: number | null;
  dedup_hash: string;
}

export type ExtraReason = 'duplicate' | 'not_in_file';

export interface ExtraRow extends DbTx {
  reason: ExtraReason;
}

export interface ImportPlan {
  /** File rows that are not yet in the app, in file order. */
  toInsert: FileTx[];
  /** File rows already present (matched against an existing row). */
  skipped: number;
  /** App rows on the file's period that the file does not account for. */
  extras: ExtraRow[];
}

/** Collapse whitespace and case so cosmetic differences between exports don't matter. */
export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Signed amount in cents: debits negative, credits positive. */
function cents(tx: { debit: number | null; credit: number | null }): number {
  return Math.round(((tx.credit ?? 0) - (tx.debit ?? 0)) * 100);
}

export function txKey(tx: { date: string; label: string; debit: number | null; credit: number | null }): string {
  return `${tx.date}|${normalizeLabel(tx.label)}|${cents(tx)}`;
}

/** Manual entries are legitimate even though no file contains them. */
export function isManualRow(row: { dedup_hash: string }): boolean {
  return /(^|:)manual:/.test(row.dedup_hash);
}

/** Inclusive [min, max] date of a file, or null when it has no rows. */
export function dateSpan(txs: { date: string }[]): { from: string; to: string } | null {
  if (txs.length === 0) return null;
  let from = txs[0].date;
  let to = txs[0].date;
  for (const tx of txs) {
    if (tx.date < from) from = tx.date;
    if (tx.date > to) to = tx.date;
  }
  return { from, to };
}

/**
 * @param fileTxs rows parsed from the file
 * @param dbRows  rows already in the app for the same account, on the file's
 *                period (callers query by dateSpan)
 */
export function planImport(fileTxs: FileTx[], dbRows: DbTx[]): ImportPlan {
  // Oldest rows first: when there are surplus rows, the newest ones are the extras
  const dbByKey = new Map<string, DbTx[]>();
  for (const row of [...dbRows].sort((a, b) => a.id - b.id)) {
    const key = txKey(row);
    const list = dbByKey.get(key);
    if (list) list.push(row);
    else dbByKey.set(key, [row]);
  }

  const seen = new Map<string, number>();
  const toInsert: FileTx[] = [];
  let skipped = 0;

  for (const tx of fileTxs) {
    const key = txKey(tx);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n <= (dbByKey.get(key)?.length ?? 0)) skipped++;
    else toInsert.push(tx);
  }

  const extras: ExtraRow[] = [];
  for (const [key, rows] of dbByKey) {
    const inFile = seen.get(key) ?? 0;
    const surplus = rows.slice(inFile).filter((r) => !isManualRow(r));
    for (const row of surplus) {
      extras.push({ ...row, reason: inFile === 0 ? 'not_in_file' : 'duplicate' });
    }
  }
  extras.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

  return { toInsert, skipped, extras };
}
