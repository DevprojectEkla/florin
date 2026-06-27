import { useTranslation } from 'react-i18next';

interface AmountRangeFilterProps {
  minAmount?: number;
  maxAmount?: number;
  onChange: (min?: number, max?: number) => void;
}

export function AmountRangeFilter({ minAmount, maxAmount, onChange }: AmountRangeFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 whitespace-nowrap">
        💰 {t('filters.amount')}:
      </label>
      <input
        type="number"
        className="input text-xs px-2 py-1 w-24"
        value={minAmount ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined, maxAmount)}
        placeholder={t('filters.min')}
        step="0.01"
      />
      <span className="text-slate-500">→</span>
      <input
        type="number"
        className="input text-xs px-2 py-1 w-24"
        value={maxAmount ?? ''}
        onChange={(e) => onChange(minAmount, e.target.value ? parseFloat(e.target.value) : undefined)}
        placeholder={t('filters.max')}
        step="0.01"
      />
    </div>
  );
}
