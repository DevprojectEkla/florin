import { useTranslation } from 'react-i18next';
import { ColorDot, TypeBadge } from './Badge';
import type { Category, CategoryType } from '../../types';

interface Props {
  category: Category;
  typeLabel: string;
  onEdit:    (cat: Category) => void;
  onArchive: (cat: Category) => void;
}

export default function CategoryRow({ category, typeLabel, onEdit, onArchive }: Props) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors hover:bg-slate-700/50 ${
      !category.is_active ? 'opacity-50' : ''
    }`}>
      {/* Color + icon */}
      <span className="text-lg w-7 text-center flex-shrink-0 leading-none">
        {category.icon ?? '🔖'}
      </span>
      <ColorDot color={category.color} />

      {/* Label */}
      <span className="flex-1 text-sm text-slate-100 truncate">
        {category.label}
        {!category.is_active && (
          <span className="ml-2 text-xs text-slate-500">({t('categories.archived')})</span>
        )}
      </span>

      {/* Type badge */}
      <TypeBadge type={category.type as CategoryType} label={typeLabel} />

      {/* System badge */}
      {category.is_system && (
        <span className="badge bg-slate-700 text-slate-400 text-xs">
          {t('categories.system')}
        </span>
      )}

      {/* Actions — visible on hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-600 transition-colors text-sm"
          onClick={() => onEdit(category)}
          title={t('common.edit')}
        >
          ✏️
        </button>
        {!category.is_system && (
          <button
            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/30 transition-colors text-sm"
            onClick={() => onArchive(category)}
            title={t('common.delete')}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
