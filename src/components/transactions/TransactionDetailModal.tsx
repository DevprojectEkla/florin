import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateTransactionCategory } from '../../hooks/useTransactions';
import { useActiveCategories } from '../../hooks/useCategories';
import { updateTransactionNotes, updateTransactionLabelClean } from '../../db/transactions';
import Modal from '../ui/Modal';
import { splitLabel } from '../../lib/utils';
import type { TransactionWithCategory } from '../../db/transactions';

interface TransactionDetailModalProps {
  transaction: TransactionWithCategory | null;
  open: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

export function TransactionDetailModal({
  transaction,
  open,
  onClose,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
}: TransactionDetailModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useActiveCategories();
  const updateCategory = useUpdateTransactionCategory();
  
  const updateNotes = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string | null }) => 
      updateTransactionNotes(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const updateLabel = useMutation({
    mutationFn: ({ id, labelClean }: { id: number; labelClean: string | null }) => 
      updateTransactionLabelClean(id, labelClean),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [labelClean, setLabelClean] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when transaction changes
  useEffect(() => {
    if (transaction) {
      const { detail } = splitLabel(transaction.label_clean ?? transaction.label);
      setCategoryId(transaction.category_id);
      setLabelClean(detail);
      setNotes(transaction.notes ?? '');
      setHasChanges(false);
    }
  }, [transaction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      // ESC to close
      if (e.key === 'Escape') {
        handleClose();
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && canNavigatePrev) {
        onNavigate?.('prev');
      }
      if (e.key === 'ArrowRight' && canNavigateNext) {
        onNavigate?.('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, hasChanges, canNavigatePrev, canNavigateNext, categoryId]);

  const handleClose = () => {
    if (hasChanges) {
      if (confirm(t('transaction_detail.unsaved_changes'))) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!transaction || !hasChanges) return;

    try {
      const promises = [];

      if (categoryId !== transaction.category_id) {
        promises.push(
          updateCategory.mutateAsync({
            id: transaction.id,
            categoryId,
          })
        );
      }

      const originalDetail = splitLabel(transaction.label_clean ?? transaction.label).detail;
      if (labelClean !== originalDetail) {
        // Reconstruct full label_clean with type prefix if it exists
        const { type } = splitLabel(transaction.label_clean ?? transaction.label);
        const newLabelClean = type ? `${type} ${labelClean}` : labelClean;
        promises.push(
          updateLabel.mutateAsync({
            id: transaction.id,
            labelClean: newLabelClean,
          })
        );
      }

      if (notes !== (transaction.notes ?? '')) {
        promises.push(
          updateNotes.mutateAsync({
            id: transaction.id,
            notes: notes.trim() || null,
          })
        );
      }

      await Promise.all(promises);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert(t('common.error'));
    }
  };

  const handleReset = () => {
    if (!transaction) return;
    const { detail } = splitLabel(transaction.label_clean ?? transaction.label);
    setCategoryId(transaction.category_id);
    setLabelClean(detail);
    setNotes(transaction.notes ?? '');
    setHasChanges(false);
  };

  const handleCategoryChange = (newCategoryId: string) => {
    const id = newCategoryId === '' ? null : parseInt(newCategoryId);
    setCategoryId(id);
    setHasChanges(true);
  };

  if (!transaction) return null;

  const { type } = splitLabel(transaction.label_clean ?? transaction.label);
  const amount = transaction.debit || transaction.credit || 0;
  const isDebit = !!transaction.debit;

  return (
    <Modal open={open} onClose={handleClose} title={t('transaction_detail.title')} size="lg">
      <div className="space-y-6">
        {/* Navigation */}
        {onNavigate && (
          <div className="flex items-center justify-between pb-4 border-b border-slate-700">
            <button
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30"
              onClick={() => onNavigate('prev')}
              disabled={!canNavigatePrev}
              title={t('transaction_detail.previous')}
            >
              ← {t('transaction_detail.previous')}
            </button>
            <button
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30"
              onClick={() => onNavigate('next')}
              disabled={!canNavigateNext}
              title={t('transaction_detail.next')}
            >
              {t('transaction_detail.next')} →
            </button>
          </div>
        )}

        {/* Date & Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction.date')}
            </label>
            <div className="input bg-slate-800 cursor-not-allowed opacity-70">
              {transaction.date}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction_detail.amount')}
            </label>
            <div className={`input bg-slate-800 font-semibold ${
              isDebit ? 'text-red-400' : 'text-green-400'
            }`}>
              {isDebit ? '-' : '+'} {amount.toFixed(2)} {t('common.currency')}
            </div>
          </div>
        </div>

        {/* Type & Label */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('transaction.type')}
          </label>
          <div className="input bg-slate-800 cursor-not-allowed opacity-70">
            {type || '—'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('transaction.label')}
          </label>
          <input
            type="text"
            className="input w-full"
            value={labelClean}
            onChange={(e) => {
              setLabelClean(e.target.value);
              setHasChanges(true);
            }}
            placeholder={t('transaction.label')}
          />
        </div>

        {/* Original Label */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('transaction_detail.original_label')}
          </label>
          <div className="input bg-slate-800 cursor-not-allowed opacity-70 text-xs text-slate-400">
            {transaction.label}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('transaction.category')}
          </label>
          <select
            className="input w-full"
            value={categoryId ?? ''}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">{t('transaction.unclassified')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('transaction.notes')}
          </label>
          <textarea
            className="input w-full min-h-[80px] resize-y"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setHasChanges(true);
            }}
            placeholder={t('transaction_detail.add_notes')}
          />
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-slate-700 space-y-2 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>{t('transaction_detail.created_at')}:</span>
            <span>{new Date(transaction.created_at).toLocaleString()}</span>
          </div>
          {transaction.import_batch_id && (
            <div className="flex justify-between">
              <span>{t('transaction_detail.import_batch')}:</span>
              <span>#{transaction.import_batch_id}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <button
            className="btn-ghost text-amber-400 hover:text-amber-300"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            🔄 {t('transaction_detail.reset')}
          </button>
          
          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={handleClose}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!hasChanges || updateCategory.isPending || updateNotes.isPending || updateLabel.isPending}
            >
              {(updateCategory.isPending || updateNotes.isPending || updateLabel.isPending)
                ? t('common.loading')
                : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
