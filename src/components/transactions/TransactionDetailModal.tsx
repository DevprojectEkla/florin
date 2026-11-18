import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateTransactionCategory, useInsertManualTransaction, useDeleteTransaction, useUpdateAttributedMonth } from '../../hooks/useTransactions';
import { useActiveCategories } from '../../hooks/useCategories';
import { updateTransactionNotes, updateTransactionLabelClean } from '../../db/transactions';
import Modal from '../ui/Modal';
import { splitLabel } from '../../lib/utils';
import type { TransactionWithCategory } from '../../db/transactions';

// ─── Edit mode (existing transaction) ────────────────────────────────────────

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
  const [attributedMonth, setAttributedMonth] = useState<string>(''); // YYYY-MM
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteTransaction = useDeleteTransaction();
  const updateAttributedMonth = useUpdateAttributedMonth();

  // Reset state when transaction changes
  useEffect(() => {
    if (transaction) {
      const { detail } = splitLabel(transaction.label_clean ?? transaction.label);
      setCategoryId(transaction.category_id);
      setLabelClean(detail);
      setNotes(transaction.notes ?? '');
      setAttributedMonth(transaction.attributed_month ?? '');
      setHasChanges(false);
      setShowDeleteConfirm(false);
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
        promises.push(updateCategory.mutateAsync({ id: transaction.id, categoryId }));
      }

      const originalDetail = splitLabel(transaction.label_clean ?? transaction.label).detail;
      if (labelClean !== originalDetail) {
        const { type } = splitLabel(transaction.label_clean ?? transaction.label);
        const newLabelClean = type ? `${type} ${labelClean}` : labelClean;
        promises.push(updateLabel.mutateAsync({ id: transaction.id, labelClean: newLabelClean }));
      }

      if (notes !== (transaction.notes ?? '')) {
        promises.push(updateNotes.mutateAsync({ id: transaction.id, notes: notes.trim() || null }));
      }

      const originalAttributed = transaction.attributed_month ?? '';
      if (attributedMonth !== originalAttributed) {
        promises.push(updateAttributedMonth.mutateAsync({
          id: transaction.id,
          attributedMonth: attributedMonth.trim() || null,
        }));
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
    setAttributedMonth(transaction.attributed_month ?? '');
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
  // Manual entries are gone for good once deleted; imported ones come back if
  // the same statement is imported again, so the confirmation says so.
  const isManual = /(^|:)manual:/.test(transaction.dedup_hash ?? '');

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('transaction_detail.title')}
      size="lg"
      footer={
        <div className="space-y-3">
          {/* Delete confirmation banner — shown above action buttons */}
          {showDeleteConfirm && (
            <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <span className="text-sm text-red-300">
                {isManual
                  ? t('transaction_detail.delete_confirm')
                  : t('transaction_detail.delete_confirm_imported')}
              </span>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                  disabled={deleteTransaction.isPending}
                  onClick={async () => {
                    await deleteTransaction.mutateAsync(transaction.id);
                    onClose();
                  }}
                >
                  {deleteTransaction.isPending ? t('common.loading') : t('common.delete')}
                </button>
              </div>
            </div>
          )}

          {/* Main actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost text-amber-400 hover:text-amber-300"
                onClick={handleReset}
                disabled={!hasChanges}
              >
                🔄 {t('transaction_detail.reset')}
              </button>
              {!showDeleteConfirm && (
                <button
                  className="btn-ghost text-red-400 hover:text-red-300"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  🗑 {t('transaction_detail.delete')}
                </button>
              )}
            </div>
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
      }
    >
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

        {/* Attributed month — only for income (salary) transactions */}
        {transaction.credit && transaction.credit > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {t('transaction_detail.attributed_month')}
            </label>
            <p className="text-xs text-slate-500 mb-2">{t('transaction_detail.attributed_month_hint')}</p>
            <div className="flex items-center gap-2">
              <input
                type="month"
                className="input w-44"
                value={attributedMonth}
                onChange={(e) => {
                  setAttributedMonth(e.target.value);
                  setHasChanges(true);
                }}
              />
              {attributedMonth && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => { setAttributedMonth(''); setHasChanges(true); }}
                >
                  ✕ {t('transaction_detail.attributed_month_clear')}
                </button>
              )}
            </div>
          </div>
        )}

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
      </div>
    </Modal>
  );
}


// ─── Create mode (new manual transaction) ────────────────────────────────────

interface AddTransactionModalProps {
  open: boolean;
  accountId: number;
  fiscalYearId: number;
  onClose: () => void;
}

export function AddTransactionModal({ open, accountId, fiscalYearId, onClose }: AddTransactionModalProps) {
  const { t } = useTranslation();
  const { data: categories = [] } = useActiveCategories();
  const insert = useInsertManualTransaction();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState('');
  const [txTypeLabel, setTxTypeLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setLabel('');
      setTxTypeLabel('');
      setOriginalLabel('');
      setTxType('debit');
      setAmount('');
      setCategoryId('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(',', '.'));
    if (!date) { setError(t('manual_tx.error_date')); return; }
    if (!label.trim()) { setError(t('manual_tx.error_label')); return; }
    if (isNaN(amountNum) || amountNum <= 0) { setError(t('manual_tx.error_amount')); return; }

    try {
      await insert.mutateAsync({
        accountId,
        fiscalYearId,
        date,
        label: (originalLabel.trim() || label.trim()),
        txTypeLabel: txTypeLabel.trim() || null,
        debit: txType === 'debit' ? amountNum : null,
        credit: txType === 'credit' ? amountNum : null,
        categoryId: categoryId ? parseInt(categoryId) : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    }
  }

  const amountNum = parseFloat(amount.replace(',', '.'));
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`✏️ ${t('manual_tx.title')}`}
      size="lg"
      footer={
        <div className="space-y-3">
          {/* Error — shown in footer so always visible */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              form="add-transaction-form"
              type="submit"
              className="btn-primary"
              disabled={insert.isPending}
            >
              {insert.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      }
    >
      <form id="add-transaction-form" onSubmit={handleSubmit}>
        <div className="space-y-6">

          {/* Date & Amount — same grid as detail modal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('transaction.date')}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('transaction_detail.amount')}
              </label>
              <div className="flex gap-2">
                {/* Debit / Credit toggle */}
                <div className="flex rounded-lg overflow-hidden border border-slate-600 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setTxType('debit')}
                    className={`px-2.5 py-1.5 text-xs transition-colors ${
                      txType === 'debit'
                        ? 'bg-red-500/20 text-red-400 font-medium'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t('transaction.debit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('credit')}
                    className={`px-2.5 py-1.5 text-xs transition-colors ${
                      txType === 'credit'
                        ? 'bg-green-500/20 text-green-400 font-medium'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t('transaction.credit')}
                  </button>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`input w-full pr-6 font-semibold ${
                      isValidAmount
                        ? txType === 'debit' ? 'text-red-400' : 'text-green-400'
                        : ''
                    }`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">€</span>
                </div>
              </div>
            </div>
          </div>

          {/* Type (transaction type label, e.g. VIR, CB, etc.) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction.type')}
              <span className="ml-1 text-xs text-slate-500">({t('common.optional')})</span>
            </label>
            <input
              type="text"
              className="input w-full"
              value={txTypeLabel}
              onChange={(e) => setTxTypeLabel(e.target.value)}
              placeholder={t('manual_tx.type_placeholder')}
            />
          </div>

          {/* Label (display label / label_clean) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction.label')}
            </label>
            <input
              type="text"
              className="input w-full"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('manual_tx.label_placeholder')}
              required
            />
          </div>

          {/* Original label */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction_detail.original_label')}
              <span className="ml-1 text-xs text-slate-500">({t('common.optional')})</span>
            </label>
            <input
              type="text"
              className="input w-full"
              value={originalLabel}
              onChange={(e) => setOriginalLabel(e.target.value)}
              placeholder={t('manual_tx.original_label_placeholder')}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('transaction.category')}
            </label>
            <select
              className="input w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('transaction_detail.add_notes')}
            />
          </div>

        </div>
      </form>
    </Modal>
  );
}
