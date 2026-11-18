import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const RELEASES_URL = 'https://github.com/DevprojectEkla/florin/releases/latest';

export interface UpdateInfo {
  /** A newer version is published. */
  available: boolean;
  version: string | null;
  notes: string | null;
  /**
   * Can this install replace itself? False for .deb/.rpm/Arch packages and
   * mobile, which are updated by their package manager / store.
   */
  canInstall: boolean;
  /** Handle needed by installUpdate(); only set when `available`. */
  update: Update | null;
}

/** Ask GitHub whether a newer version is published. Throws on network errors. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const update = await check();
  if (!update) {
    return { available: false, version: null, notes: null, canInstall: false, update: null };
  }
  const canInstall = await invoke<boolean>('can_self_update').catch(() => false);
  return {
    available: true,
    version: update.version,
    notes: update.body ?? null,
    canInstall,
    update,
  };
}

/**
 * Download and install, then restart. `onProgress` receives a 0..1 fraction
 * (or null when the size is unknown). On Windows the installer closes the app
 * itself, so relaunch() may never run there — that is expected.
 */
export async function installUpdate(
  update: Update,
  onProgress?: (fraction: number | null) => void
): Promise<void> {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
      onProgress?.(total > 0 ? 0 : null);
    } else if (event.event === 'Progress') {
      received += event.data.chunkLength;
      onProgress?.(total > 0 ? Math.min(1, received / total) : null);
    } else if (event.event === 'Finished') {
      onProgress?.(1);
    }
  });
  await relaunch();
}
