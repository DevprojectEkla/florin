import { useTranslation } from 'react-i18next';

interface TypeStatusFiltersProps {
  type: 'debit' | 'credit' | null;
  status: 'classified' | 'unclassified' | null;
  onTypeChange: (type: 'debit' | 'credit' | null) => void;
  onStatusChange: (status: 'classified' | 'unclassified' | null) => void;
}

export function TypeStatusFilters({ 
  type, 
  status, 
  onTypeChange, 
  onStatusChange 
}: TypeStatusFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4">
      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap">
          📂 {t('filters.type')}:
        </label>
        <select
          className="input text-xs px-2 py-1"
          value={type || ''}
          onChange={(e) => onTypeChange(e.target.value as any || null)}
        >
          <option value="">{t('filters.all')}</option>
          <option value="debit">{t('filters.expenses')}</option>
          <option value="credit">{t('filters.income')}</option>
        </select>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 whitespace-nowrap">
          ⚡ {t('filters.status')}:
        </label>
        <select
          className="input text-xs px-2 py-1"
          value={status || ''}
          onChange={(e) => onStatusChange(e.target.value as any || null)}
        >
          <option value="">{t('filters.all')}</option>
          <option value="classified">{t('filters.classified')}</option>
          <option value="unclassified">{t('filters.unclassified')}</option>
        </select>
      </div>
    </div>
  );
}
