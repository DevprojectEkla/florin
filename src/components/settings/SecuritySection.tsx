import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changePassword } from '../../db/auth';
import { validatePasswordChange, MIN_PASSWORD_LENGTH } from '../../lib/password';

export default function SecuritySection() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);

    const problem = validatePasswordChange(current, next, confirm);
    if (problem) {
      setError(t(`security.error_${problem.toLowerCase()}`, { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await changePassword(current, next);
      if (result.ok) {
        setSuccess(true);
        setCurrent('');
        setNext('');
        setConfirm('');
      } else if (result.reason === 'LOCKED') {
        setError(t('security.error_locked', { seconds: result.secondsRemaining }));
      } else {
        setError(t('security.error_wrong_current', { remaining: result.remainingAttempts }));
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Change password error:', err);
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('security.title')}</h2>
      <p className="text-slate-400 text-sm mb-6">{t('security.subtitle')}</p>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1" htmlFor="pw-current">
            {t('security.current_password')}
          </label>
          <input
            id="pw-current"
            type="password"
            className="input"
            autoComplete="current-password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setError(''); setSuccess(false); }}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1" htmlFor="pw-new">
            {t('security.new_password')}
          </label>
          <input
            id="pw-new"
            type="password"
            className="input"
            autoComplete="new-password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setError(''); setSuccess(false); }}
          />
          <p className="text-slate-500 text-xs mt-1">
            {t('security.min_length_hint', { min: MIN_PASSWORD_LENGTH })}
          </p>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1" htmlFor="pw-confirm">
            {t('security.confirm_password')}
          </label>
          <input
            id="pw-confirm"
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); setSuccess(false); }}
          />
        </div>

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        {success && <p role="status" className="text-green-400 text-sm">{t('security.success')}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('common.loading') : t('security.submit')}
        </button>
      </form>
    </div>
  );
}
