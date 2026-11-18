import { useTranslation } from 'react-i18next';

/**
 * Native date pickers (WebKitGTK/Chromium) stay open after a day is picked.
 * Blur the input once the value holds a complete date (4-digit year), which
 * closes the popup without interrupting someone typing the year by hand.
 */
function closePickerWhenComplete(input: HTMLInputElement) {
  const year = parseInt(input.value.slice(0, 4), 10);
  if (input.value && year >= 1000) input.blur();
}

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
        onChange={(e) => {
          onChange(e.target.value || undefined, dateTo);
          closePickerWhenComplete(e.currentTarget);
        }}
        placeholder={t('filters.from')}
      />
      <span className="text-slate-500">→</span>
      <input
        type="date"
        className="input text-xs px-2 py-1 w-32"
        value={dateTo || ''}
        onChange={(e) => {
          onChange(dateFrom, e.target.value || undefined);
          closePickerWhenComplete(e.currentTarget);
        }}
        placeholder={t('filters.to')}
      />
    </div>
  );
}
