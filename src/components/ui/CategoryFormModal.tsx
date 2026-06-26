import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import ColorPicker from './ColorPicker';
import IconPicker from './IconPicker';
import type { Category, CategoryType } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    label: string;
    type: CategoryType;
    color: string | null;
    icon: string | null;
    slug: string;
  }) => void;
  initial?: Category | null;
  loading?: boolean;
}

const TYPES: CategoryType[] = ['income', 'fixed', 'variable', 'savings', 'transfer'];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function CategoryFormModal({ open, onClose, onSubmit, initial, loading }: Props) {
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [label, setLabel]     = useState('');
  const [type, setType]       = useState<CategoryType>('variable');
  const [color, setColor]     = useState<string | null>(null);
  const [icon, setIcon]       = useState<string | null>(null);
  const [tab, setTab]         = useState<'color' | 'icon'>('color');
  const [error, setError]     = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? '');
    setType(initial?.type ?? 'variable');
    setColor(initial?.color ?? null);
    setIcon(initial?.icon ?? null);
    setError('');
    setTab('color');
  }, [open, initial]);

  function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed) { setError(t('categories.error_label_required')); return; }
    const slug = isEdit ? initial!.slug : `custom.${slugify(trimmed)}`;
    onSubmit({ label: trimmed, type, color, icon, slug });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('categories.edit_title') : t('categories.add_title')}
      size="md"
    >
      <div className="space-y-4">
        {/* Label */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">{t('categories.label')}</label>
          <input
            className="input"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
            placeholder={t('categories.label_placeholder')}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>

        {/* Type — disabled on system categories */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">{t('categories.type')}</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t_) => (
              <button
                key={t_}
                type="button"
                disabled={isEdit && !!initial?.is_system}
                onClick={() => setType(t_)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  type === t_
                    ? 'bg-florin-500 text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {t(`category.types.${t_}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Color + Icon tabs */}
        <div>
          <div className="flex gap-3 mb-3 border-b border-slate-700 pb-2">
            {(['color', 'icon'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`text-sm font-medium pb-1 transition-colors ${
                  tab === k
                    ? 'text-florin-400 border-b-2 border-florin-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`categories.tab_${k}`)}
              </button>
            ))}
            {/* Preview */}
            <div className="ml-auto flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color ?? '#64748b' }}
              />
              <span className="text-lg leading-none">{icon ?? '🔖'}</span>
            </div>
          </div>

          {tab === 'color' && <ColorPicker value={color} onChange={setColor} />}
          {tab === 'icon'  && <IconPicker  value={icon}  onChange={setIcon}  />}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
