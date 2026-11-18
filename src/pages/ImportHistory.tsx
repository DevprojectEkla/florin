import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import Modal from '../components/ui/Modal';
import { getImportHistory, type ImportHistoryRow } from '../db/import-history';
import { importsFolderPath, readStoredFile } from '../lib/import-store';
import { decodeCsvBytes, readCsvTable } from '../lib/csv-import';

/** Rendering thousands of rows in a plain table is slow; the viewer is for inspection. */
const MAX_VIEW_ROWS = 3000;

export default function ImportHistory() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['import-history'],
    queryFn: getImportHistory,
  });
  const [folder, setFolder] = useState('');
  const [viewing, setViewing] = useState<ImportHistoryRow | null>(null);

  useEffect(() => {
    importsFolderPath().then(setFolder).catch(() => setFolder(''));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-100">{t('import_history.title')}</h1>
        <Link to="/import" className="btn-ghost text-sm whitespace-nowrap">
          ← {t('import_history.back')}
        </Link>
      </div>
      <p className="text-slate-400 text-sm mb-1">{t('import_history.subtitle')}</p>
      {folder && (
        <p className="text-slate-500 text-xs mb-5 font-mono break-all">
          {t('import_history.folder')}: {folder}
        </p>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="card text-slate-400 text-sm">{t('import_history.empty')}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="px-3 py-2 font-medium">{t('import_history.col_date')}</th>
                <th className="px-3 py-2 font-medium">{t('import_history.col_file')}</th>
                <th className="px-3 py-2 font-medium">{t('import_history.col_account')}</th>
                <th className="px-3 py-2 font-medium">{t('import_history.col_period')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('import_history.col_in_file')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('import_history.col_added')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('import_history.col_skipped')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('import_history.col_in_app')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const matches = r.rows_in_app === (r.rows_in_file ?? 0);
                return (
                  <tr key={r.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {r.imported_at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 text-slate-200 max-w-[16rem] truncate" title={r.filename}>
                      {r.filename}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.account_name}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {r.tx_from ? `${r.tx_from} → ${r.tx_to}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.rows_in_file ?? 0}</td>
                    <td className="px-3 py-2 text-right text-green-400">{r.rows_imported ?? 0}</td>
                    <td className="px-3 py-2 text-right text-yellow-400">{r.rows_skipped ?? 0}</td>
                    <td
                      className={`px-3 py-2 text-right ${matches ? 'text-slate-300' : 'text-amber-400'}`}
                      title={matches ? undefined : t('import_history.in_app_differs')}
                    >
                      {r.rows_in_app}{!matches && ' ⚠'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="btn-ghost text-xs disabled:opacity-40"
                        disabled={!r.stored_path}
                        title={r.stored_path ? undefined : t('import_history.no_copy')}
                        onClick={() => setViewing(r)}
                      >
                        👁 {t('import_history.view')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewing && <FileViewer batch={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ─── File viewer ─────────────────────────────────────────────────────────────

async function loadRows(batch: ImportHistoryRow): Promise<string[][]> {
  const bytes = await readStoredFile(batch.stored_path!);
  if (/\.(csv|txt)$/i.test(batch.filename)) {
    return readCsvTable(decodeCsvBytes(bytes)).rows;
  }
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
    .map((row) => row.map((cell) => String(cell ?? '')));
}

function FileViewer({ batch, onClose }: { batch: ImportHistoryRow; onClose: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadRows(batch)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e) => {
        if (import.meta.env.DEV) console.error('Viewer error:', e);
        if (!cancelled) setError(t('import_history.read_error'));
      });
    return () => { cancelled = true; };
  }, [batch, t]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.some((c) => c.toLowerCase().includes(q))) : rows;
    return list.slice(0, MAX_VIEW_ROWS);
  }, [rows, query]);

  const columns = useMemo(
    () => filtered.reduce((max, r) => Math.max(max, r.length), 0),
    [filtered]
  );

  return (
    <Modal open onClose={onClose} title={batch.filename} size="xl">
      <div className="space-y-3">
        <input
          className="input"
          placeholder={t('import_history.search')}
          aria-label={t('import_history.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        {!rows && !error && <p className="text-slate-400 text-sm">{t('common.loading')}</p>}
        {rows && (
          <>
            <p className="text-xs text-slate-500">
              {t('import_history.rows_shown', { shown: filtered.length, total: rows.length })}
            </p>
            <div className="overflow-auto max-h-[60vh] border border-slate-700 rounded-lg">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-slate-700/50 last:border-0 align-top">
                      {Array.from({ length: columns }, (_, c) => (
                        <td key={c} className="px-2 py-1 text-slate-300 whitespace-pre-wrap">
                          {row[c] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
