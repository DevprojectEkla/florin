import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBulkUpdateCategory, useBulkDeleteTransactions } from '../../hooks/useBulkUpdateTransactions';
import ConfirmDialog from '../ui/ConfirmDialog';
import type { Category } from '../../types';

interface BulkActionsToolbarProps {
  selectedIds: number[];
  selectedCount: number;
  categories: Category[];
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedIds,
  selectedCount,
  categories,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const bulkUpdateCategory = useBulkUpdateCategory();
  const bulkDelete = useBulkDeleteTransactions();

  const handleCategoryChange = async (categoryId: string) => {
    if (!categoryId) return;

    try {
      const result = await bulkUpdateCategory.mutateAsync({
        ids: selectedIds,
        categoryId: categoryId === 'null' ? null : parseInt(categoryId),
      });

      if (result.succeeded > 0) {
        // Success - clear selection
        onClearSelection();
      }

      if (result.failed > 0) {
        alert(
          t('bulk.partial_failure', {
            succeeded: result.succeeded,
            failed: result.failed,
          })
        );
      }
    } catch (error) {
      console.error('Bulk category update failed:', error);
      alert(t('bulk.error'));
    }
  };

  const handleDelete = async () => {
    try {
      const result = await bulkDelete.mutateAsync(selectedIds);

      if (result.succeeded > 0) {
        onClearSelection();
      }

      if (result.failed > 0) {
        alert(
          t('bulk.partial_failure', {
            succeeded: result.succeeded,
            failed: result.failed,
          })
        );
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert(t('bulk.error'));
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const isLoading = bulkUpdateCategory.isPending || bulkDelete.isPending;

  // Always render with content to prevent layout shift
  return (
    <>
      <div 
        className={`rounded-lg px-4 py-3 transition-all duration-200 min-h-[3.5rem] ${
          selectedCount > 0
            ? 'bg-florin-500/10 border border-florin-500/30'
            : 'bg-slate-800/30 border border-slate-700/50'
        }`}
      >
        {selectedCount > 0 ? (
          <>
            <div className="flex items-center justify-between">
          {/* Selection Count */}
          <span className="text-sm font-medium text-florin-300">
            {t('selection.count', { count: selectedCount })}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Category Selector */}
            <select
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-florin-500 focus:border-transparent disabled:opacity-50"
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={isLoading}
              value=""
            >
              <option value="">{t('bulk.assign_category')}</option>
              <option value="null">─ {t('transaction.unclassified')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>

            {/* Delete Button */}
            <button
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading}
            >
              {t('bulk.delete')}
            </button>

            {/* Clear Selection */}
            <button
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              {t('selection.clear')}
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="mt-2 text-xs text-slate-400">
            {t('bulk.processing')}...
          </div>
        )}
          </>
        ) : (
          // Default content when nothing selected
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>
              💡 {t('bulk.hint')}
            </span>
            <span className="text-xs">
              {t('bulk.shortcut')}
            </span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('bulk.delete_confirm_title')}
        message={t('bulk.delete_confirm_message', { count: selectedCount })}
        confirmLabel={t('common.delete')}
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
