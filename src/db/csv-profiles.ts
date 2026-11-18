import { getDb } from './client';
import type { CsvMapping } from '../lib/csv-import';

/**
 * Remembered CSV column mappings, keyed by header signature (see
 * headerSignature in lib/csv-import). Stored in the existing app_settings
 * key/value table, so no migration is needed.
 */
const PREFIX = 'csv_profile:';

export async function loadCsvProfile(signature: string): Promise<CsvMapping | null> {
  if (!signature) return null;
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM app_settings WHERE key = ?',
    [PREFIX + signature]
  );
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].value) as CsvMapping;
  } catch {
    return null; // corrupt entry: fall back to auto-detection
  }
}

export async function saveCsvProfile(signature: string, mapping: CsvMapping): Promise<void> {
  if (!signature) return;
  const db = await getDb();
  await db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [PREFIX + signature, JSON.stringify(mapping)]
  );
}
