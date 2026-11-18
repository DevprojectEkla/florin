import { mkdir, writeFile, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

/**
 * Imported statements are kept under <app data dir>/imports/account-<id>/ so
 * they stay available for inspection after the import. Paths stored in the
 * database are relative to the app data dir.
 */
const IMPORTS_DIR = 'imports';

/** Keep file names readable but safe for any filesystem. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 120);
  return cleaned || 'statement';
}

/** `2026-11-18_221103` — sortable, unique enough for one user. */
function timestamp(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

/** Copy an imported file into the app's import folder; returns the relative path. */
export async function storeImportedFile(
  accountId: number,
  filename: string,
  bytes: Uint8Array
): Promise<string> {
  const dir = `${IMPORTS_DIR}/account-${accountId}`;
  await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  const relPath = `${dir}/${timestamp()}_${safeFileName(filename)}`;
  await writeFile(relPath, bytes, { baseDir: BaseDirectory.AppData });
  return relPath;
}

export async function readStoredFile(relPath: string): Promise<Uint8Array> {
  return readFile(relPath, { baseDir: BaseDirectory.AppData });
}

/** Absolute location of the import folder, for display. */
export async function importsFolderPath(): Promise<string> {
  return join(await appDataDir(), IMPORTS_DIR);
}
