import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  useUpdateCheck,
  useAutoUpdateCheck,
  useSetAutoUpdateCheck,
} from '../../hooks/useUpdateCheck';
import { installUpdate, RELEASES_URL } from '../../lib/updater';

export default function UpdatesSection() {
  const { t } = useTranslation();
  const { data: info, isFetching, isFetched, error, refetch } = useUpdateCheck();
  const { data: autoCheck = true } = useAutoUpdateCheck();
  const setAutoCheck = useSetAutoUpdateCheck();

  // undefined = not installing, null = size unknown, number = 0..1
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const [installError, setInstallError] = useState('');

  async function handleInstall() {
    if (!info?.update) return;
    setInstallError('');
    setProgress(null);
    try {
      await installUpdate(info.update, setProgress);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Update install error:', e);
      setInstallError(t('updates.install_error'));
      setProgress(undefined);
    }
  }

  const installing = progress !== undefined;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">{t('updates.title')}</h2>
        <p className="text-slate-400 text-sm">
          {t('updates.current_version', { version: __APP_VERSION__ })}
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            onClick={() => refetch()}
            disabled={isFetching || installing}
          >
            {isFetching ? t('updates.checking') : t('updates.check_now')}
          </button>
          {isFetched && !isFetching && !error && !info?.available && (
            <span role="status" className="text-green-400 text-sm">✓ {t('updates.up_to_date')}</span>
          )}
        </div>

        {error && !isFetching && (
          <p role="alert" className="text-red-400 text-sm">{t('updates.check_error')}</p>
        )}

        {info?.available && !isFetching && (
          <div className="space-y-3">
            <p className="text-slate-100 font-medium">
              🎉 {t('updates.available', { version: info.version })}
            </p>

            {info.notes && (
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto border border-slate-700 rounded-lg p-3">
                {info.notes}
              </pre>
            )}

            {info.canInstall ? (
              <>
                <button className="btn-primary" onClick={handleInstall} disabled={installing}>
                  {installing ? t('updates.installing') : t('updates.install')}
                </button>
                {installing && (
                  <div
                    className="h-2 bg-slate-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress === null || progress === undefined ? undefined : Math.round(progress * 100)}
                  >
                    <div
                      className={`h-full bg-florin-500 transition-all ${progress === null ? 'w-1/3 animate-pulse' : ''}`}
                      style={progress === null ? undefined : { width: `${Math.round((progress ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500">{t('updates.restart_note')}</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">{t('updates.managed_externally')}</p>
                <button className="btn-ghost text-sm" onClick={() => openUrl(RELEASES_URL)}>
                  ↗ {t('updates.open_release_page')}
                </button>
              </>
            )}

            {installError && <p role="alert" className="text-red-400 text-sm">{installError}</p>}
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={autoCheck}
          onChange={(e) => setAutoCheck.mutate(e.target.checked)}
        />
        <span>
          <span className="block text-sm text-slate-200">{t('updates.auto_check')}</span>
          <span className="block text-xs text-slate-500">{t('updates.auto_check_hint')}</span>
        </span>
      </label>
    </div>
  );
}
