import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseCAFile, type ParsedImport } from '../lib/ca-parser';
import {
  applyMapping,
  decodeCsvBytes,
  detectHeaderRow,
  guessMapping,
  headerSignature,
  readCsvTable,
  type CsvMapping,
  type CsvTable,
} from '../lib/csv-import';
import { useQueryClient } from '@tanstack/react-query';
import { importTransactions, type ImportResult } from '../db/import';
import { deleteTransactions } from '../db/transactions';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { loadCsvProfile, saveCsvProfile } from '../db/csv-profiles';
import {
  createAccount,
  findAccountByNumber,
  resolveFiscalYearForDate,
  updateAccount,
} from '../db/accounts';
import { normalizeAccountNumber } from '../lib/accounts';
import { useActiveAccount } from '../store/AccountContext';
import CsvMappingStep from '../components/import/CsvMappingStep';

interface CsvSession {
  table: CsvTable;
  filename: string;
  fromProfile: boolean;
}

export default function Import() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { accounts, activeAccount, setActiveAccountId } = useActiveAccount();

  const [status, setStatus] = useState<
    'idle' | 'parsing' | 'mapping' | 'choose_account' | 'importing' | 'done' | 'error'
  >('idle');
  // Account the last import went into (may differ from the active account)
  const [targetAccount, setTargetAccount] = useState<{ id: number; name: string } | null>(null);
  // "Which account is this file for?" step state
  const [choice, setChoice] = useState<number | 'new'>(0);
  const [newAccountName, setNewAccountName] = useState('');
  // Raw bytes of the file being imported, kept so a copy can be stored with the import
  const sourceRef = useRef<Uint8Array | null>(null);
  const [confirmRemoveExtras, setConfirmRemoveExtras] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError]   = useState('');
  const [csv, setCsv]       = useState<CsvSession | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [remember, setRemember] = useState(true);

  function reportError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) console.error('Import error:', e);

    if (msg.includes('INVALID_CA_FORMAT')) {
      setError(t('import.error_invalid_format'));
    } else {
      setError(`${t('common.error')}: ${msg}`);
    }
    setStatus('error');
  }

  /**
   * Route a parsed file to the right account: the one whose number matches the
   * file's account number, else (when ambiguous) ask the user.
   */
  async function runImport(parsedData: ParsedImport) {
    setParsed(parsedData);
    if (accounts.length === 0) {
      setError(t('import.error_no_account'));
      setStatus('error');
      return;
    }

    const detected = await findAccountByNumber(parsedData.accountNumber);
    if (detected) {
      await importInto(parsedData, detected);
      return;
    }

    const hasNumber = normalizeAccountNumber(parsedData.accountNumber) !== '';
    if (accounts.length === 1 && !hasNumber) {
      await importInto(parsedData, accounts[0]);
      return;
    }

    // Unknown account number, or several accounts and nothing to tell them apart
    setChoice(activeAccount?.id ?? accounts[0].id);
    setNewAccountName(
      parsedData.accountNumber ? `${t('import.account')} ${parsedData.accountNumber}` : ''
    );
    setStatus('choose_account');
  }

  async function importInto(
    parsedData: ParsedImport,
    account: { id: number; name: string; bank_name?: string; account_number?: string | null }
  ) {
    setStatus('importing');
    const firstDate =
      parsedData.transactions.map((tx) => tx.date).sort()[0] ??
      new Date().toISOString().slice(0, 10);
    const fy = await resolveFiscalYearForDate(account.id, firstDate);
    const importResult = await importTransactions(parsedData, account.id, fy.id, {
      sourceBytes: sourceRef.current ?? undefined,
    });

    // Remember the number so the next file for this account is matched automatically
    if (!account.account_number && normalizeAccountNumber(parsedData.accountNumber) !== '') {
      await updateAccount(account.id, {
        name: account.name,
        bank_name: account.bank_name ?? 'Crédit Agricole',
        account_number: parsedData.accountNumber,
      });
    }

    for (const key of ['transactions', 'aggregates', 'balance', 'fiscal-year', 'fiscal-years', 'accounts', 'import-history']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    setTargetAccount({ id: account.id, name: account.name });
    setResult(importResult);
    setStatus('done');
  }

  async function handleConfirmAccount() {
    if (!parsed) return;
    try {
      if (choice === 'new') {
        const name = newAccountName.trim();
        if (!name) { setError(t('onboarding.error_account_name')); return; }
        setError('');
        const id = await createAccount({
          name,
          bank_name: 'Crédit Agricole',
          account_number: parsed.accountNumber ?? undefined,
        });
        qc.invalidateQueries({ queryKey: ['accounts'] });
        await importInto(parsed, { id, name, account_number: parsed.accountNumber });
        await setActiveAccountId(id);
      } else {
        const account = accounts.find((a) => a.id === choice);
        if (!account) return;
        await importInto(parsed, account);
      }
    } catch (e) {
      reportError(e);
    }
  }

  async function handleSelectFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: t('import.file_filter'), extensions: ['xlsx', 'xls', 'csv', 'txt'] }],
      });

      if (!selected) return; // User cancelled

      const filePath = selected as string;
      // Handle both POSIX and Windows path separators
      const filename = filePath.split(/[\\/]/).pop() ?? filePath;
      const isCsv = /\.(csv|txt)$/i.test(filename);

      setStatus('parsing');
      setError('');

      // Read file
      const fileBytes = await readFile(filePath);
      sourceRef.current = fileBytes;

      if (isCsv) {
        // CSV layouts differ per bank: detect, then let the user review the mapping.
        const table = readCsvTable(decodeCsvBytes(fileBytes));
        const headerRow = Math.max(0, detectHeaderRow(table.rows));
        const saved = await loadCsvProfile(headerSignature(table.rows[headerRow] ?? []));
        setCsv({ table, filename, fromProfile: saved !== null });
        setMapping(saved ? { ...saved, headerRow } : guessMapping(table, headerRow));
        setStatus('mapping');
        return;
      }

      await runImport(parseCAFile(fileBytes.buffer as ArrayBuffer, filename));
    } catch (e) {
      reportError(e);
    }
  }

  function handleHeaderRowChange(headerRow: number) {
    if (!csv) return;
    setCsv({ ...csv, fromProfile: false });
    setMapping(guessMapping(csv.table, headerRow));
  }

  async function handleConfirmMapping() {
    if (!csv || !mapping) return;
    try {
      const { parsed: parsedData } = applyMapping(csv.table, mapping, csv.filename);
      if (remember) {
        await saveCsvProfile(headerSignature(csv.table.rows[mapping.headerRow] ?? []), mapping);
      }
      await runImport(parsedData);
    } catch (e) {
      reportError(e);
    }
  }

  function handleReset() {
    setStatus('idle');
    setParsed(null);
    setResult(null);
    setError('');
    setCsv(null);
    setMapping(null);
    setTargetAccount(null);
    sourceRef.current = null;
    setConfirmRemoveExtras(false);
  }

  async function handleRemoveExtras() {
    if (!result) return;
    try {
      await deleteTransactions(result.extras.map((e) => e.id));
      for (const key of ['transactions', 'aggregates', 'balance']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      setResult({
        ...result,
        rowsInPeriod: result.rowsInPeriod - result.extras.length,
        extras: [],
      });
    } catch (e) {
      reportError(e);
    } finally {
      setConfirmRemoveExtras(false);
    }
  }

  return (
    <div className={`p-6 mx-auto ${status === 'mapping' ? 'max-w-3xl' : 'max-w-2xl'}`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-100">{t('import.title')}</h1>
        <Link to="/import/history" className="btn-ghost text-sm whitespace-nowrap">
          🗂 {t('import_history.link')}
        </Link>
      </div>
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

      {status === 'mapping' && csv && mapping && (
        <CsvMappingStep
          table={csv.table}
          filename={csv.filename}
          mapping={mapping}
          fromProfile={csv.fromProfile}
          remember={remember}
          onMappingChange={setMapping}
          onHeaderRowChange={handleHeaderRowChange}
          onRememberChange={setRemember}
          onConfirm={handleConfirmMapping}
          onCancel={handleReset}
        />
      )}

      {status === 'choose_account' && parsed && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{t('import.choose_account_title')}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {parsed.accountNumber
                ? t('import.choose_account_unknown', { number: parsed.accountNumber })
                : t('import.choose_account_no_number')}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">{t('import.choose_account_title')}</legend>
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="import-account"
                  checked={choice === a.id}
                  onChange={() => setChoice(a.id)}
                />
                <span className="text-slate-200 text-sm">
                  {a.name}
                  {a.account_number && (
                    <span className="text-slate-500 font-mono ml-2">{a.account_number}</span>
                  )}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="import-account"
                checked={choice === 'new'}
                onChange={() => setChoice('new')}
              />
              <span className="text-slate-200 text-sm">{t('import.choose_account_new')}</span>
            </label>
          </fieldset>

          {choice === 'new' && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('onboarding.account_name')}</label>
              <input
                className="input"
                value={newAccountName}
                onChange={(e) => { setNewAccountName(e.target.value); setError(''); }}
              />
            </div>
          )}

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={handleReset}>{t('common.cancel')}</button>
            <button className="btn-primary flex-1" onClick={handleConfirmAccount}>
              {t('import.choose_account_confirm')}
            </button>
          </div>
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

          <ImportCheck result={result} onReview={() => setConfirmRemoveExtras(true)} />

          {targetAccount && (
            <p className="text-center text-sm text-slate-300">
              {t('import.imported_into', { account: targetAccount.name })}
              {targetAccount.id !== activeAccount?.id && (
                <button
                  className="ml-2 text-florin-400 underline"
                  onClick={() => setActiveAccountId(targetAccount.id)}
                >
                  {t('account_settings.switch_to')}
                </button>
              )}
            </p>
          )}

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

      {result && (
        <ConfirmDialog
          open={confirmRemoveExtras}
          danger
          title={t('import.extras_confirm_title')}
          message={t('import.extras_confirm_message', { count: result.extras.length })}
          confirmLabel={t('import.extras_remove')}
          onConfirm={handleRemoveExtras}
          onCancel={() => setConfirmRemoveExtras(false)}
        />
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

// ─── File vs app check ───────────────────────────────────────────────────────

/** Compares the file with what the app holds on the same period. */
function ImportCheck({ result, onReview }: { result: ImportResult; onReview: () => void }) {
  const { t } = useTranslation();
  const manual = Math.max(0, result.rowsInPeriod - result.rowsInFile - result.extras.length);
  const ok = result.extras.length === 0;

  return (
    <div
      className={`rounded-lg p-3 text-sm space-y-2 ${
        ok ? 'bg-green-500/10 text-green-300' : 'bg-amber-500/10 text-amber-300'
      }`}
      role={ok ? 'status' : 'alert'}
    >
      <p className="font-medium">
        {ok ? '✅ ' : '⚠️ '}
        {ok ? t('import.check_ok') : t('import.check_mismatch', { count: result.extras.length })}
      </p>
      <p className="text-xs opacity-80">
        {t('import.check_counts', {
          file: result.rowsInFile,
          app: result.rowsInPeriod,
          from: result.periodFrom ?? '—',
          to: result.periodTo ?? '—',
        })}
        {manual > 0 && ` ${t('import.check_manual', { count: manual })}`}
      </p>

      {!ok && (
        <>
          <ul className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
            {result.extras.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="flex-shrink-0">{e.date}</span>
                <span className="truncate flex-1" title={e.label}>{e.label.replace(/\s+/g, ' ')}</span>
                <span className="flex-shrink-0">
                  {e.debit ? `-${e.debit.toFixed(2)}` : `+${(e.credit ?? 0).toFixed(2)}`}
                </span>
                <span className="flex-shrink-0 opacity-70">
                  {t(e.reason === 'duplicate' ? 'import.extra_duplicate' : 'import.extra_not_in_file')}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-ghost text-xs" onClick={onReview}>
            🗑 {t('import.extras_remove')}
          </button>
        </>
      )}
    </div>
  );
}
