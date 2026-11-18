import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyMapping,
  type AmountMode,
  type CsvMapping,
  type CsvTable,
  type DateOrder,
  type DecimalSeparator,
} from '../../lib/csv-import';

interface Props {
  table: CsvTable;
  filename: string;
  mapping: CsvMapping;
  fromProfile: boolean;
  remember: boolean;
  onMappingChange: (mapping: CsvMapping) => void;
  /** Header row changed by the user: the parent re-guesses the whole mapping. */
  onHeaderRowChange: (headerRow: number) => void;
  onRememberChange: (remember: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const PREVIEW_ROWS = 8;
const DELIMITER_NAMES: Record<string, string> = { ';': ';', ',': ',', '\t': 'Tab', '|': '|' };

export default function CsvMappingStep({
  table, filename, mapping, fromProfile, remember,
  onMappingChange, onHeaderRowChange, onRememberChange, onConfirm, onCancel,
}: Props) {
  const { t } = useTranslation();

  const header = table.rows[mapping.headerRow] ?? [];
  const columnCount = Math.max(
    header.length,
    ...table.rows.slice(mapping.headerRow + 1, mapping.headerRow + 50).map((r) => r.length)
  );
  const columns = Array.from({ length: columnCount }, (_, i) => ({
    index: i,
    name: header[i]?.trim() || t('import.column_n', { n: i + 1 }),
  }));

  const { parsed, rejected } = useMemo(
    () => applyMapping(table, mapping, filename),
    [table, mapping, filename]
  );
  const preview = parsed.transactions.slice(0, PREVIEW_ROWS);

  const set = (patch: Partial<CsvMapping>) => onMappingChange({ ...mapping, ...patch });
  const colSelect = (value: number | null, onChange: (v: number | null) => void, label: string) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{t('import.not_mapped')}</option>
        {columns.map((c) => (
          <option key={c.index} value={c.index}>{c.name}</option>
        ))}
      </select>
    </div>
  );

  const canImport =
    parsed.transactions.length > 0 &&
    mapping.date !== null &&
    mapping.labels.length > 0 &&
    (mapping.amountMode === 'signed' ? mapping.amount !== null : mapping.debit !== null || mapping.credit !== null);

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{t('import.mapping_title')}</h2>
        <p className="text-slate-400 text-sm mt-1">{t('import.mapping_subtitle')}</p>
        <p className="text-slate-500 text-xs mt-2">
          {filename} · {t('import.delimiter')}: <span className="font-mono">{DELIMITER_NAMES[table.delimiter] ?? table.delimiter}</span>
          {fromProfile && <span className="ml-2 text-florin-400">✓ {t('import.profile_loaded')}</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('import.header_row')}</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, table.rows.length)}
            className="input"
            value={mapping.headerRow + 1}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value));
              if (n >= 1 && n <= table.rows.length) onHeaderRowChange(n - 1);
            }}
          />
        </div>
        {colSelect(mapping.date, (v) => set({ date: v }), t('import.col_date'))}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">{t('import.col_labels')}</label>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {columns.map((c) => (
            <label key={c.index} className="flex items-center gap-1.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={mapping.labels.includes(c.index)}
                onChange={(e) =>
                  set({
                    labels: e.target.checked
                      ? [...mapping.labels, c.index].sort((a, b) => a - b)
                      : mapping.labels.filter((i) => i !== c.index),
                  })
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4 text-sm text-slate-300">
          {(['split', 'signed'] as AmountMode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="amountMode"
                checked={mapping.amountMode === mode}
                onChange={() => set({ amountMode: mode })}
              />
              {t(`import.amount_mode_${mode}`)}
            </label>
          ))}
        </div>

        {mapping.amountMode === 'split' ? (
          <div className="grid grid-cols-2 gap-3">
            {colSelect(mapping.debit, (v) => set({ debit: v }), t('import.col_debit'))}
            {colSelect(mapping.credit, (v) => set({ credit: v }), t('import.col_credit'))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {colSelect(mapping.amount, (v) => set({ amount: v }), t('import.col_amount'))}
            <label className="flex items-center gap-2 text-sm text-slate-300 self-end pb-2">
              <input
                type="checkbox"
                checked={mapping.invertSign}
                onChange={(e) => set({ invertSign: e.target.checked })}
              />
              {t('import.invert_sign')}
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('import.date_order')}</label>
          <select
            className="input"
            value={mapping.dateOrder}
            onChange={(e) => set({ dateOrder: e.target.value as DateOrder })}
          >
            <option value="DMY">DD/MM/YYYY</option>
            <option value="MDY">MM/DD/YYYY</option>
            <option value="YMD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('import.decimal')}</label>
          <select
            className="input"
            value={mapping.decimal}
            onChange={(e) => set({ decimal: e.target.value as DecimalSeparator })}
          >
            <option value=",">1 234,56</option>
            <option value=".">1,234.56</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-300 mb-2">
          {t('import.preview_count', { count: parsed.transactions.length })}
          {rejected.length > 0 && (
            <span className="text-yellow-400 ml-2">
              · {t('import.rejected_count', { count: rejected.length })}
            </span>
          )}
        </p>
        {preview.length > 0 ? (
          <div className="overflow-x-auto rounded-lg bg-slate-700/40">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="px-2 py-1.5">{t('import.col_date')}</th>
                  <th className="px-2 py-1.5">{t('import.preview_label')}</th>
                  <th className="px-2 py-1.5 text-right">{t('import.col_debit')}</th>
                  <th className="px-2 py-1.5 text-right">{t('import.col_credit')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((tx, i) => (
                  <tr key={i} className="border-t border-slate-600/40">
                    <td className="px-2 py-1 font-mono whitespace-nowrap">{tx.date}</td>
                    <td className="px-2 py-1 max-w-[18rem] truncate" title={tx.label}>
                      {tx.label.replace(/\n/g, ' ⏎ ')}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{tx.debit?.toFixed(2) ?? ''}</td>
                    <td className="px-2 py-1 text-right font-mono">{tx.credit?.toFixed(2) ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-red-400">{t('import.preview_empty')}</p>
        )}
        {rejected.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {t('import.rejected_hint', { line: rejected[0].line, reason: t(`import.reject_${rejected[0].reason}`) })}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
        {t('import.remember')}
      </label>

      <div className="flex gap-3">
        <button className="btn-secondary flex-1" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn-primary flex-1" onClick={onConfirm} disabled={!canImport}>
          {t('import.import_n', { count: parsed.transactions.length })}
        </button>
      </div>
    </div>
  );
}
