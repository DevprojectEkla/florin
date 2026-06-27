import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { TransactionWithCategory } from '../../db/transactions';

interface ExportMenuProps {
  transactions: TransactionWithCategory[];
  selectedIds?: Set<number>;
  fiscalYearLabel?: string;
}

type ExportFormat = 'csv' | 'excel' | 'json';
type ExportScope = 'current' | 'selected' | 'all';

export function ExportMenu({ transactions, selectedIds, fiscalYearLabel }: ExportMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('current');
  const [isExporting, setIsExporting] = useState(false);

  const selectedCount = selectedIds?.size ?? 0;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Determine which transactions to export
      let dataToExport = transactions;
      if (scope === 'selected' && selectedIds && selectedIds.size > 0) {
        dataToExport = transactions.filter(tx => selectedIds.has(tx.id));
      }
      // 'current' uses filtered transactions already
      // 'all' would need all transactions - for now treat as 'current'

      if (dataToExport.length === 0) {
        alert(t('export.no_data'));
        return;
      }

      // Prepare export data
      const exportData = dataToExport.map(tx => ({
        Date: tx.date,
        'Libellé': tx.label,
        'Libellé nettoyé': tx.label_clean ?? '',
        'Débit': tx.debit ?? '',
        'Crédit': tx.credit ?? '',
        'Catégorie': tx.category_label ?? t('transaction.unclassified'),
        'Hors budget': tx.is_out_of_budget ? 'Oui' : 'Non',
        'Notes': tx.notes ?? '',
      }));

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fyPart = fiscalYearLabel ? `-${fiscalYearLabel.replace(/[^a-zA-Z0-9]/g, '')}` : '';
      const scopePart = scope === 'selected' ? `-selection` : '';
      const filename = `florin-transactions${fyPart}${scopePart}-${timestamp}`;

      // Export based on format
      if (format === 'csv') {
        const csv = Papa.unparse(exportData, {
          quotes: true,
          delimiter: ',',
        });
        downloadFile(csv, `${filename}.csv`, 'text/csv');
      } else if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
        
        // Auto-size columns
        const maxWidth = 50;
        const colWidths = Object.keys(exportData[0] || {}).map(key => {
          const maxLen = Math.max(
            key.length,
            ...exportData.map(row => String(row[key as keyof typeof row] ?? '').length)
          );
          return { wch: Math.min(maxLen + 2, maxWidth) };
        });
        worksheet['!cols'] = colWidths;

        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else if (format === 'json') {
        const json = JSON.stringify(exportData, null, 2);
        downloadFile(json, `${filename}.json`, 'application/json');
      }

      setShowModal(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      alert(t('export.error'));
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary flex items-center gap-2"
        title={t('export.export')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {t('export.export')}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  setFormat('csv');
                  setShowModal(true);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {t('export.csv')}
              </button>
              <button
                onClick={() => {
                  setFormat('excel');
                  setShowModal(true);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {t('export.excel')}
              </button>
              <button
                onClick={() => {
                  setFormat('json');
                  setShowModal(true);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {t('export.json')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Export Options Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-slate-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-slate-100">
                {t('export.options_title')}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {t('export.format')}: {format.toUpperCase()}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Scope Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('export.scope')}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="current"
                      checked={scope === 'current'}
                      onChange={(e) => setScope(e.target.value as ExportScope)}
                      className="text-emerald-500"
                    />
                    <span className="text-sm text-slate-200">
                      {t('export.scope_current')} ({transactions.length})
                    </span>
                  </label>

                  {selectedCount > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="selected"
                        checked={scope === 'selected'}
                        onChange={(e) => setScope(e.target.value as ExportScope)}
                        className="text-emerald-500"
                      />
                      <span className="text-sm text-slate-200">
                        {t('export.scope_selected')} ({selectedCount})
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="bg-slate-900/50 border border-slate-700 rounded p-3">
                <p className="text-xs text-slate-400">
                  {t('export.info')}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
                disabled={isExporting}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExport}
                className="btn-primary"
                disabled={isExporting}
              >
                {isExporting ? t('export.exporting') : t('export.export')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
