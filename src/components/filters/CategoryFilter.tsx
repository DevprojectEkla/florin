import { useTranslation } from 'react-i18next';
import type { Category } from '../../types';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategories?: number[];
  onChange: (selected: number[]) => void;
}

export function CategoryFilter({ categories, selectedCategories = [], onChange }: CategoryFilterProps) {
  const { t } = useTranslation();

  const handleToggle = (categoryId: number) => {
    if (selectedCategories.includes(categoryId)) {
      onChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onChange([...selectedCategories, categoryId]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 whitespace-nowrap mt-1.5">
        🏷️ {t('filters.categories')}:
      </label>
      <div className="flex-1">
        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                selectedCategories.includes(cat.id)
                  ? 'bg-florin-500/20 text-florin-400 border border-florin-500/50'
                  : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
              }`}
              onClick={() => handleToggle(cat.id)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
        {selectedCategories.length > 0 && (
          <button
            className="text-xs text-slate-500 hover:text-slate-300 mt-2"
            onClick={handleClear}
          >
            {t('filters.clear_selection')} ({selectedCategories.length})
          </button>
        )}
      </div>
    </div>
  );
}
