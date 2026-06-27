import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TransactionFilters } from '../../hooks/useTransactionFilters';

interface PresetFilter {
  id: string;
  label: string;
  icon: string;
  filters: Partial<TransactionFilters>;
  isCustom?: boolean;
}

interface PresetFiltersProps {
  onApplyPreset: (filters: Partial<TransactionFilters>) => void;
  currentFilters: TransactionFilters;
}

const getBuiltInPresets = (t: any): PresetFilter[] => {
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0];
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  return [
    {
      id: 'unclassified',
      label: t('presets.unclassified'),
      icon: '🚨',
      filters: { status: 'unclassified' },
    },
    {
      id: 'this-month',
      label: t('presets.this_month'),
      icon: '📅',
      filters: { dateFrom: thisMonthStart, dateTo: todayStr },
    },
    {
      id: 'last-30-days',
      label: t('presets.last_30_days'),
      icon: '📆',
      filters: { dateFrom: last30Days, dateTo: todayStr },
    },
    {
      id: 'large-expenses',
      label: t('presets.large_expenses'),
      icon: '💰',
      filters: { minAmount: 500, type: 'debit' },
    },
    {
      id: 'income-only',
      label: t('presets.income_only'),
      icon: '💵',
      filters: { type: 'credit' },
    },
  ];
};

export function PresetFilters({ onApplyPreset, currentFilters }: PresetFiltersProps) {
  const { t } = useTranslation();
  const [customPresets, setCustomPresets] = useState<PresetFilter[]>(() => {
    const stored = localStorage.getItem('transaction-presets');
    return stored ? JSON.parse(stored) : [];
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  const builtInPresets = getBuiltInPresets(t);
  const allPresets = [...builtInPresets, ...customPresets];

  const hasActiveFilters = 
    currentFilters.dateFrom ||
    currentFilters.dateTo ||
    currentFilters.minAmount !== undefined ||
    currentFilters.maxAmount !== undefined ||
    (currentFilters.categories && currentFilters.categories.length > 0) ||
    currentFilters.type ||
    currentFilters.status;

  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: PresetFilter = {
      id: `custom-${Date.now()}`,
      label: presetName,
      icon: '⭐',
      filters: {
        dateFrom: currentFilters.dateFrom,
        dateTo: currentFilters.dateTo,
        minAmount: currentFilters.minAmount,
        maxAmount: currentFilters.maxAmount,
        categories: currentFilters.categories,
        type: currentFilters.type,
        status: currentFilters.status,
      },
      isCustom: true,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('transaction-presets', JSON.stringify(updated));
    setPresetName('');
    setShowSaveModal(false);
  };

  const handleDeletePreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem('transaction-presets', JSON.stringify(updated));
  };

  return (
    <div className="space-y-2">
      {/* Preset chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">
          {t('presets.quick_filters')}:
        </span>

        {allPresets.map((preset) => (
          <div key={preset.id} className="flex items-center gap-1">
            <button
              onClick={() => onApplyPreset(preset.filters)}
              className="preset-chip"
              title={preset.label}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>

            {preset.isCustom && (
              <button
                onClick={() => handleDeletePreset(preset.id)}
                className="text-slate-500 hover:text-red-400 transition-colors"
                title={t('presets.delete')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Save current filters button */}
        {hasActiveFilters && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="preset-chip preset-chip-save"
            title={t('presets.save_current')}
          >
            <span>💾</span>
            <span>{t('presets.save')}</span>
          </button>
        )}
      </div>

      {/* Save preset modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">
                {t('presets.save_preset')}
              </h3>
            </div>

            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('presets.preset_name')}
              </label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('presets.preset_name_placeholder')}
                className="input w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                  if (e.key === 'Escape') setShowSaveModal(false);
                }}
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="btn-primary"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
