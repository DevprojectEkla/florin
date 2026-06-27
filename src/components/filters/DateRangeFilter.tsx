import { useTranslation } from 'react-i18next';

interface DateRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (dateFrom?: string, dateTo?: string) => void;
}

export function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 whitespace-nowrap">
        📅 {t('filters.date_range')}:
      </label>
      <input
        type="date"
        className="input text-xs px-2 py-1 w-32"
        value={dateFrom || ''}
        onChange={(e) => onChange(e.target.value || undefined, dateTo)}
        placeholder={t('filters.from')}
      />
      <span className="text-slate-500">→</span>
      <input
        type="date"
        className="input text-xs px-2 py-1 w-32"
        value={dateTo || ''}
        onChange={(e) => onChange(dateFrom, e.target.value || undefined)}
        placeholder={t('filters.to')}
      />
    </div>
  );
}
