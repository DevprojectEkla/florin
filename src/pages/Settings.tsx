import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CategoryFormModal from '../components/ui/CategoryFormModal';
import CategoryRow from '../components/ui/CategoryRow';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  useAllCategories,
  useCreateCategory,
  useUpdateCategory,
  useArchiveCategory,
} from '../hooks/useCategories';
import type { Category, CategoryType } from '../types';

const SECTION_KEYS = ['categories', 'language'] as const;
type Section = typeof SECTION_KEYS[number];

const TYPE_ORDER: CategoryType[] = ['income', 'fixed', 'variable', 'savings', 'transfer'];

export default function Settings() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('categories');

  return (
    <div className="flex h-full">
      {/* Section sidebar */}
      <div className="w-44 border-r border-slate-700 flex-shrink-0 p-3 space-y-1">
        {SECTION_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              section === key
                ? 'bg-florin-500/10 text-florin-400 font-medium'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            {t(`settings.sections.${key}`)}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-6">
        {section === 'categories' && <CategoriesSection />}
        {section === 'language'   && <LanguageSection />}
      </div>
    </div>
  );
}

// ─── Categories Section ───────────────────────────────────────────────────────

function CategoriesSection() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useAllCategories();
  const createMutation  = useCreateCategory();
  const updateMutation  = useUpdateCategory();
  const archiveMutation = useArchiveCategory();

  const [showArchived, setShowArchived] = useState(false);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<Category | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);

  const visible = categories.filter((c) => showArchived || c.is_active);

  // Group by type in defined order
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: t(`category.types.${type}`),
    items: visible.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  function openAdd() { setEditTarget(null); setFormOpen(true); }
  function openEdit(cat: Category) { setEditTarget(cat); setFormOpen(true); }

  async function handleFormSubmit(data: {
    label: string; type: CategoryType;
    color: string | null; icon: string | null; slug: string;
  }) {
    if (editTarget) {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        input: { label: data.label, color: data.color ?? undefined, icon: data.icon ?? undefined },
      });
    } else {
      await createMutation.mutateAsync({
        slug:  data.slug,
        label: data.label,
        type:  data.type,
        color: data.color ?? undefined,
        icon:  data.icon  ?? undefined,
      });
    }
    setFormOpen(false);
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    await archiveMutation.mutateAsync(archiveTarget.id);
    setArchiveTarget(null);
  }

  if (isLoading) {
    return <div className="text-slate-400 text-sm">{t('common.loading')}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{t('categories.page_title')}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{t('categories.page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? t('categories.hide_archived') : t('categories.show_archived')}
          </button>
          <button className="btn-primary text-sm" onClick={openAdd}>
            + {t('categories.add_button')}
          </button>
        </div>
      </div>

      {/* Grouped list */}
      <div className="space-y-6">
        {grouped.map(({ type, label, items }) => (
          <div key={type}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
              {label}
              <span className="ml-2 text-slate-600 font-normal normal-case">{items.length}</span>
            </h3>
            <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
              {items.length === 0 ? (
                <p className="px-3 py-3 text-slate-500 text-sm">{t('categories.empty')}</p>
              ) : (
                items.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    typeLabel={label}
                    onEdit={openEdit}
                    onArchive={setArchiveTarget}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initial={editTarget}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Archive/delete confirm */}
      {archiveTarget && (
        <ConfirmDialog
          open={!!archiveTarget}
          title={t('categories.confirm_archive_title')}
          message={t('categories.confirm_archive_msg')}
          danger
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Language Section ─────────────────────────────────────────────────────────

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const current = i18n.language;

  async function switchLang(lang: string) {
    await i18n.changeLanguage(lang);
    // Persist to DB
    try {
      const { getDb } = await import('../db/client');
      const db = await getDb();
      await db.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('default_language', ?)",
        [lang]
      );
    } catch (_) {}
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('settings.sections.language')}</h2>
      <p className="text-slate-400 text-sm mb-6">{t('settings.language.label')}</p>

      <div className="flex gap-3">
        {(['fr', 'en'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => switchLang(lang)}
            className={`px-5 py-3 rounded-xl border text-sm font-medium transition-colors ${
              current === lang
                ? 'border-florin-400 bg-florin-500/10 text-florin-400'
                : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
            }`}
          >
            {lang === 'fr' ? '🇫🇷' : '🇬🇧'} {t(`settings.language.${lang}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
