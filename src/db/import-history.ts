import { getDb } from './client';
import type { ImportBatch } from '../types';

export interface ImportHistoryRow extends ImportBatch {
  account_name: string;
  /** Rows the app currently holds for that account on the file's period. */
  rows_in_app: number;
}

/** All imports, newest first, with the live row count on each file's period. */
export async function getImportHistory(): Promise<ImportHistoryRow[]> {
  const db = await getDb();
  return db.select<ImportHistoryRow[]>(
    `SELECT b.*,
            a.name AS account_name,
            CASE WHEN b.tx_from IS NULL THEN 0 ELSE (
              SELECT COUNT(*) FROM transactions t
              WHERE t.account_id = b.account_id
                AND t.date BETWEEN b.tx_from AND b.tx_to
            ) END AS rows_in_app
     FROM import_batches b
     JOIN accounts a ON a.id = b.account_id
     ORDER BY b.id DESC`
  );
}
