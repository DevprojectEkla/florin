import { useTranslation } from 'react-i18next';
export default function Budget() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-100 mb-4">{t('nav.budget')}</h1>
      <div className="card text-slate-400">Coming soon.</div>
    </div>
  );
}
