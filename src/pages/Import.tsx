import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseCAFile, type ParsedImport } from '../lib/ca-parser';
import { importTransactions, type ImportResult } from '../db/import';
import { useFirstAccount, useActiveFiscalYear } from '../hooks/useAccounts';

export default function Import() {
  const { t } = useTranslation();
  const { data: account } = useFirstAccount();
  const { data: fiscalYear } = useActiveFiscalYear(account?.id);

  const [status, setStatus] = useState<'idle' | 'parsing' | 'importing' | 'done' | 'error'>('idle');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError]   = useState('');

  async function handleSelectFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      });

      if (!selected) return; // User cancelled

      const filePath = selected as string;
      const filename = filePath.split('/').pop() ?? filePath;

      setStatus('parsing');
      setError('');

      // Read file
      const fileBytes = await readFile(filePath);
      const buffer = fileBytes.buffer;

      // Parse
      const parsedData = parseCAFile(buffer as ArrayBuffer, filename);
      setParsed(parsedData);

      // Auto-import
      if (!account || !fiscalYear) {
        setError(t('import.error_no_account'));
        setStatus('error');
        return;
      }

      setStatus('importing');
      const importResult = await importTransactions(parsedData, account.id, fiscalYear.id);
      setResult(importResult);
      setStatus('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (import.meta.env.DEV) console.error('Import error:', e);

      if (msg.includes('INVALID_CA_FORMAT')) {
        setError(t('import.error_invalid_format'));
      } else {
        setError(`${t('common.error')}: ${msg}`);
      }
      setStatus('error');
    }
  }

  function handleReset() {
    setStatus('idle');
    setParsed(null);
    setResult(null);
    setError('');
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">{t('import.title')}</h1>
      <p className="text-slate-400 text-sm mb-6">{t('import.subtitle')}</p>

      {status === 'idle' && (
        <div
          onClick={handleSelectFile}
          className="card border-2 border-dashed border-slate-600 hover:border-florin-400
                     cursor-pointer transition-colors py-16 text-center group"
        >
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📁</div>
          <p className="text-slate-300 font-medium">{t('import.drop_hint')}</p>
          <p className="text-slate-500 text-sm mt-2">
            {t('import.or')} <span className="text-florin-400 underline">{t('import.browse')}</span>
          </p>
        </div>
      )}

      {status === 'parsing' && (
        <div className="card py-12 text-center">
          <div className="text-3xl animate-spin mb-3">⏳</div>
          <p className="text-slate-300">{t('import.parsing')}</p>
        </div>
      )}

      {status === 'importing' && (
        <div className="card py-12 text-center">
          <div className="text-3xl animate-pulse mb-3">📥</div>
          <p className="text-slate-300">{t('import.importing')}</p>
          {parsed && (
            <p className="text-slate-500 text-sm mt-1">
              {parsed.transactions.length} transactions…
            </p>
          )}
        </div>
      )}

      {status === 'done' && result && (
        <div className="card space-y-4">
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-semibold text-slate-100">{t('import.done_title')}</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{result.imported}</div>
              <div className="text-xs text-slate-400 mt-1">{t('import.imported')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
              <div className="text-xs text-slate-400 mt-1">{t('import.skipped_label')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{parsed?.transactions.length ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">{t('import.total_in_file')}</div>
            </div>
          </div>

          {parsed && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300 space-y-1">
              {parsed.accountNumber && <p>📋 {t('import.account')}: {parsed.accountNumber}</p>}
              {parsed.periodFrom && parsed.periodTo && (
                <p>📅 {t('import.period')}: {parsed.periodFrom} → {parsed.periodTo}</p>
              )}
              {parsed.balanceAtImport != null && (
                <p>💰 {t('import.balance')}: {parsed.balanceAtImport.toFixed(2)} €</p>
              )}
            </div>
          )}

          <button className="btn-primary w-full" onClick={handleReset}>
            {t('import.import_another')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="card space-y-4">
          <div className="text-center py-4">
            <div className="text-4xl mb-3">❌</div>
            <p className="text-red-400">{error}</p>
          </div>
          <button className="btn-primary w-full" onClick={handleReset}>
            {t('import.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
