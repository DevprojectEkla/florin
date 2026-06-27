import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Column } from './types';

interface ColumnVisibilityMenuProps {
  columns: Column[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnId: string, visible: boolean) => void;
  onResetToDefaults: () => void;
}

export function ColumnVisibilityMenu({
  columns,
  visibleColumns,
  onVisibilityChange,
  onResetToDefaults,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const visibleCount = visibleColumns.size;

  return (
    <div className="relative" ref={menuRef}>
      {/* Toggle Button */}
      <button
        className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
        title={t('table.column_visibility')}
      >
        <span>👁️</span>
        <span>{t('table.columns')}</span>
        <span className="text-xs opacity-70">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">
                {t('table.show_columns')}
              </span>
              <button
                className="text-xs text-florin-400 hover:text-florin-300 transition-colors"
                onClick={() => {
                  onResetToDefaults();
                  setIsOpen(false);
                }}
              >
                {t('table.reset_defaults')}
              </button>
            </div>
          </div>

          <div className="p-2 max-h-80 overflow-y-auto">
            {columns.map((column) => {
              const isVisible = visibleColumns.has(column.id);
              const isOnlyVisible = isVisible && visibleCount === 1;

              return (
                <label
                  key={column.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isOnlyVisible
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={isOnlyVisible}
                    onChange={(e) => onVisibilityChange(column.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-florin-500 focus:ring-florin-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-sm text-slate-200">{column.label}</span>
                </label>
              );
            })}
          </div>

          <div className="p-2 border-t border-slate-700 text-xs text-slate-500 text-center">
            {t('table.visible_count', { count: visibleCount, total: columns.length })}
          </div>
        </div>
      )}
    </div>
  );
}
