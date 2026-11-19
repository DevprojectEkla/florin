import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useReclassify } from '../../hooks/useRules';
import { useActiveCategories } from '../../hooks/useCategories';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import type { ClassificationRule } from '../../db/rules';

const PATTERN_TYPES = ['contains', 'starts_with', 'regex'] as const;

export default function RuleEditor() {
  const { t } = useTranslation();
  const { data: rules = [], isLoading } = useRules();
  const { data: categories = [] } = useActiveCategories();
  const createMut = useCreateRule();
  const updateMut = useUpdateRule();
  const deleteMut = useDeleteRule();
  const reclassifyMut = useReclassify();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassificationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassificationRule | null>(null);

  // Form state
  const [pattern, setPattern]           = useState('');
  const [patternType, setPatternType]   = useState<string>('contains');
  const [categoryId, setCategoryId]     = useState<number | ''>('');
  const [priority, setPriority]         = useState(100);

  function openAdd() {
    setEditTarget(null);
    setPattern('');
    setPatternType('contains');
    setCategoryId('');
    setPriority(100);
    setFormOpen(true);
  }

  function openEdit(rule: ClassificationRule) {
    setEditTarget(rule);
    setPattern(rule.pattern);
    setPatternType(rule.pattern_type);
    setCategoryId(rule.category_id);
    setPriority(rule.priority);
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!pattern.trim() || !categoryId) return;
    if (editTarget) {
      await updateMut.mutateAsync({
        id: editTarget.id,
        input: { pattern: pattern.trim(), pattern_type: patternType, category_id: categoryId as number, priority },
      });
    } else {
      await createMut.mutateAsync({
        pattern: pattern.trim(),
        pattern_type: patternType,
        category_id: categoryId as number,
        priority,
      });
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleReclassify() {
    const count = await reclassifyMut.mutateAsync();
    if (import.meta.env.DEV) console.log(`Reclassified ${count} transactions`);
  }

  if (isLoading) return <p className="text-slate-400 text-sm">{t('common.loading')}</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{t('rules.page_title')}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{t('rules.page_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={handleReclassify}
            disabled={reclassifyMut.isPending}
          >
            {reclassifyMut.isPending ? '⏳' : '🔄'} {t('rules.reclassify')}
          </button>
          <button className="btn-primary text-sm" onClick={openAdd}>
            + {t('rules.add')}
          </button>
        </div>
      </div>

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="card text-slate-400">{t('common.empty')}</div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">{t('rules.pattern')}</th>
                <th className="px-3 py-2.5 text-left w-24">{t('rules.type')}</th>
                <th className="px-3 py-2.5 text-left w-40">{t('transaction.category')}</th>
                <th className="px-3 py-2.5 text-center w-16">{t('rules.priority')}</th>
                <th className="px-3 py-2.5 text-center w-16">{t('rules.hits')}</th>
                <th className="px-3 py-2.5 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rules.map((rule) => (
                <tr key={rule.id} className={`hover:bg-slate-700/30 ${!rule.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-200">{rule.pattern}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{rule.pattern_type}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: rule.category_color ?? '#64748b' }}
                      />
                      {rule.category_icon} {rule.category_label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-slate-400">{rule.priority}</td>
                  <td className="px-3 py-2 text-center text-xs text-slate-500">{rule.match_count}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-600 text-xs"
                        onClick={() => openEdit(rule)}
                      >✏️</button>
                      <button
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/30 text-xs"
                        onClick={() => setDeleteTarget(rule)}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? t('rules.edit_title') : t('rules.add_title')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('rules.pattern')}</label>
            <input
              className="input font-mono"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="CARREFOUR"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('rules.type')}</label>
              <select className="input" value={patternType} onChange={(e) => setPatternType(e.target.value)}>
                {PATTERN_TYPES.map((pt) => (
                  <option key={pt} value={pt}>{t(`rules.pattern_types.${pt}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('rules.priority')}</label>
              <input
                className="input"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min={0}
                max={999}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('transaction.category')}</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : '')}
            >
              <option value="">—</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!pattern.trim() || !categoryId || createMut.isPending || updateMut.isPending}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          title={t('rules.delete_title')}
          message={t('rules.delete_msg', { pattern: deleteTarget.pattern })}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
