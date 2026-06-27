import { useTranslation } from 'react-i18next';

interface SelectionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
}

export function SelectionToolbar({ selectedCount, onClearSelection }: SelectionToolbarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="bg-florin-500/10 border border-florin-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-florin-300">
          {t('selection.count', { count: selectedCount })}
        </span>
      </div>
      
      <button
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        onClick={onClearSelection}
      >
        {t('selection.clear')}
      </button>
    </div>
  );
}
