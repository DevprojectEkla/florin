import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useActiveAccount } from '../../store/AccountContext';
import { getFiscalYears } from '../../db/accounts';
import {
  useCreateAccount,
  useUpdateAccount,
  useSetOpeningBalance,
} from '../../hooks/useAccounts';
import type { Account } from '../../types';

interface AccountFormValues {
  name: string;
  bank_name: string;
  account_number: string;
}

export default function AccountSection() {
  const { t } = useTranslation();
  const { accounts, activeAccount, setActiveAccountId } = useActiveAccount();
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();

  // `null` = no form open, 'new' = creating, number = editing that account id
  const [formTarget, setFormTarget] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(values: AccountFormValues) {
    if (!values.name.trim()) { setError(t('onboarding.error_account_name')); return; }
    setError('');
    const input = {
      name: values.name.trim(),
      bank_name: values.bank_name.trim() || 'Crédit Agricole',
      account_number: values.account_number.trim() || null,
    };
    try {
      if (formTarget === 'new') {
        const id = await createMutation.mutateAsync({
          name: input.name,
          bank_name: input.bank_name,
          account_number: input.account_number ?? undefined,
        });
        await setActiveAccountId(id);
      } else if (typeof formTarget === 'number') {
        await updateMutation.mutateAsync({ id: formTarget, input });
      }
      setFormTarget(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Account save error:', e);
      setError(t('common.error'));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{t('account_settings.title')}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{t('account_settings.subtitle')}</p>
          </div>
          {formTarget === null && (
            <button className="btn-primary text-sm" onClick={() => { setError(''); setFormTarget('new'); }}>
              + {t('account_settings.add')}
            </button>
          )}
        </div>

        {formTarget === 'new' && (
          <AccountForm
            title={t('account_settings.add')}
            initial={{ name: '', bank_name: 'Crédit Agricole', account_number: '' }}
            error={error}
            saving={createMutation.isPending}
            onSubmit={handleSubmit}
            onCancel={() => setFormTarget(null)}
          />
        )}

        <div className="space-y-3">
          {accounts.map((account) =>
            formTarget === account.id ? (
              <AccountForm
                key={account.id}
                title={t('account_settings.edit')}
                initial={{
                  name: account.name,
                  bank_name: account.bank_name,
                  account_number: account.account_number ?? '',
                }}
                error={error}
                saving={updateMutation.isPending}
                onSubmit={handleSubmit}
                onCancel={() => setFormTarget(null)}
              />
            ) : (
              <AccountCard
                key={account.id}
                account={account}
                isActive={activeAccount?.id === account.id}
                onSelect={() => setActiveAccountId(account.id)}
                onEdit={() => { setError(''); setFormTarget(account.id); }}
              />
            )
          )}
        </div>
      </div>

      {activeAccount && <OpeningBalanceAdmin account={activeAccount} />}
    </div>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({ account, isActive, onSelect, onEdit }: {
  account: Account;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`card flex items-center justify-between gap-4 ${
        isActive ? 'ring-1 ring-florin-400/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 truncate">{account.name}</span>
          {isActive && (
            <span className="badge bg-florin-500/15 text-florin-400 text-xs px-2 py-0.5">
              {t('account_settings.active')}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-400 truncate">{account.bank_name}</div>
        <div className="text-xs text-slate-500 font-mono mt-0.5">
          {account.account_number
            ? `${t('account_settings.number')}: ${account.account_number}`
            : t('account_settings.no_number')}
          {' · '}{account.currency}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isActive && (
          <button className="btn-ghost text-sm" onClick={onSelect}>
            {t('account_settings.switch_to')}
          </button>
        )}
        <button className="btn-ghost text-sm" onClick={onEdit}>
          ✏️ {t('account_settings.edit')}
        </button>
      </div>
    </div>
  );
}

// ─── Create / edit form ───────────────────────────────────────────────────────

function AccountForm({ title, initial, error, saving, onSubmit, onCancel }: {
  title: string;
  initial: AccountFormValues;
  error: string;
  saving: boolean;
  onSubmit: (values: AccountFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AccountFormValues>(initial);
  const set = (key: keyof AccountFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form
      className="card space-y-4 mb-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}
    >
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <div>
        <label className="block text-sm text-slate-300 mb-1">{t('onboarding.account_name')}</label>
        <input className="input" value={values.name} onChange={set('name')} autoFocus />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">{t('onboarding.bank_name')}</label>
        <input className="input" value={values.bank_name} onChange={set('bank_name')} />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">
          {t('onboarding.account_number')}
          <span className="text-slate-500 ml-1">({t('common.optional')})</span>
        </label>
        <input
          className="input font-mono"
          value={values.account_number}
          onChange={set('account_number')}
          placeholder="00032999227"
        />
        <p className="text-slate-500 text-xs mt-1">{t('account_settings.number_hint')}</p>
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

// ─── Administrative: opening balance ──────────────────────────────────────────

function OpeningBalanceAdmin({ account }: { account: Account }) {
  const { t } = useTranslation();
  const setOpening = useSetOpeningBalance();
  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['fiscal-years', account.id],
    queryFn: () => getFiscalYears(account.id),
  });

  // Default to the latest fiscal year: the live balance is anchored on it.
  const [fyId, setFyId] = useState<number | null>(null);
  const fy = fiscalYears.find((f) => f.id === fyId) ?? fiscalYears[0] ?? null;

  const [value, setValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Reset the field when the target fiscal year (or account) changes
  useEffect(() => {
    setValue(fy?.opening_balance != null ? String(fy.opening_balance) : '');
    setSaved(false);
    setError('');
  }, [fy?.id, fy?.opening_balance, account.id]);

  if (!fy) {
    return (
      <div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">{t('account_settings.opening_title')}</h2>
        <p className="text-slate-500 text-sm">{t('account_settings.opening_no_fy')}</p>
      </div>
    );
  }

  const parsed = value.trim() === '' ? null : parseFloat(value.replace(',', '.'));
  const invalid = parsed !== null && Number.isNaN(parsed);
  const unchanged = (parsed ?? null) === (fy.opening_balance ?? null);
  const fmt = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)} €`);

  function handleAskConfirm() {
    if (invalid) { setError(t('account_settings.opening_invalid')); return; }
    setError('');
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!fy) return;
    try {
      await setOpening.mutateAsync({ fiscalYearId: fy.id, openingBalance: parsed });
      setSaved(true);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Opening balance error:', e);
      setError(t('common.error'));
    } finally {
      setConfirmOpen(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold text-slate-100 mb-1">
        🔐 {t('account_settings.opening_title')}
      </h2>
      <p className="text-slate-400 text-sm mb-4">{t('account_settings.opening_subtitle')}</p>

      <div className="card space-y-4 border border-amber-500/20">
        <div>
          <label className="block text-sm text-slate-300 mb-1" htmlFor="opening-fy">
            {t('account_settings.opening_fy')}
          </label>
          <select
            id="opening-fy"
            className="input"
            value={fy.id}
            onChange={(e) => setFyId(parseInt(e.target.value))}
          >
            {fiscalYears.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1" htmlFor="opening-value">
            {t('onboarding.opening_balance')}
          </label>
          <input
            id="opening-value"
            className="input"
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaved(false); setError(''); }}
          />
          <p className="text-slate-500 text-xs mt-1">
            {t('account_settings.opening_current', { value: fmt(fy.opening_balance) })}
          </p>
        </div>

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        {saved && <p role="status" className="text-green-400 text-sm">{t('account_settings.opening_saved')}</p>}

        <button className="btn-primary" disabled={unchanged || invalid} onClick={handleAskConfirm}>
          {t('account_settings.opening_update')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        danger
        title={t('account_settings.opening_confirm_title')}
        message={t('account_settings.opening_confirm_message', {
          account: account.name,
          fy: fy.label,
          from: fmt(fy.opening_balance),
          to: fmt(parsed),
        })}
        confirmLabel={t('account_settings.opening_confirm_button')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
