import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateAccount, useCreateFiscalYear } from '../hooks/useAccounts';

interface Props {
  onComplete: () => void;
}

type Step = 'account' | 'fiscal_year';

export default function OnboardingWizard({ onComplete }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('account');
  const [error, setError] = useState('');

  // Account form state
  const [accountName, setAccountName] = useState('Compte Courant');
  const [bankName, setBankName]       = useState('Crédit Agricole');
  const [accountNumber, setAccountNumber] = useState('');

  // Fiscal year form state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultStartMonth = 9; // September
  const defaultLabel = currentMonth >= defaultStartMonth
    ? `${currentYear}-${currentYear + 1}`
    : `${currentYear - 1}-${currentYear}`;

  const [fyLabel, setFyLabel]           = useState(defaultLabel);
  const [fyStartMonth, setFyStartMonth] = useState(defaultStartMonth);
  const [fyStartYear, setFyStartYear]   = useState(
    currentMonth >= defaultStartMonth ? currentYear : currentYear - 1
  );
  const [openingBalance, setOpeningBalance] = useState('');

  const createAccountMut  = useCreateAccount();
  const createFiscalYearMut = useCreateFiscalYear();
  const [accountId, setAccountId] = useState<number | null>(null);

  async function handleAccountSubmit() {
    if (!accountName.trim()) { setError(t('onboarding.error_account_name')); return; }
    setError('');
    try {
      const id = await createAccountMut.mutateAsync({
        name:           accountName.trim(),
        bank_name:      bankName.trim() || 'Crédit Agricole',
        account_number: accountNumber.trim() || undefined,
      });
      setAccountId(id);
      setStep('fiscal_year');
    } catch (e) {
      setError(t('common.error'));
    }
  }

  async function handleFiscalYearSubmit() {
    if (!fyLabel.trim()) { setError(t('onboarding.error_fy_label')); return; }
    if (!accountId) { setError(t('common.error')); return; }
    setError('');
    try {
      await createFiscalYearMut.mutateAsync({
        account_id:      accountId,
        label:           fyLabel.trim(),
        start_year:      fyStartYear,
        start_month:     fyStartMonth,
        opening_balance: openingBalance ? parseFloat(openingBalance) : undefined,
      });
      onComplete();
    } catch (e) {
      setError(t('common.error'));
    }
  }

  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-florin-400 text-5xl mb-2">ƒ</div>
          <h1 className="text-2xl font-bold text-slate-100">{t('onboarding.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('onboarding.subtitle')}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${step === 'account' ? 'bg-florin-400' : 'bg-slate-600'}`} />
          <div className={`w-8 h-0.5 ${step === 'fiscal_year' ? 'bg-florin-400' : 'bg-slate-700'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'fiscal_year' ? 'bg-florin-400' : 'bg-slate-600'}`} />
        </div>

        <div className="card space-y-5">
          {step === 'account' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('onboarding.account_title')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('onboarding.account_subtitle')}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">{t('onboarding.account_name')}</label>
                <input
                  className="input"
                  value={accountName}
                  onChange={(e) => { setAccountName(e.target.value); setError(''); }}
                  placeholder="Compte Courant"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">{t('onboarding.bank_name')}</label>
                <input
                  className="input"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Crédit Agricole"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  {t('onboarding.account_number')}
                  <span className="text-slate-500 ml-1">({t('common.optional')})</span>
                </label>
                <input
                  className="input"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="00012345678"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                className="btn-primary w-full"
                onClick={handleAccountSubmit}
                disabled={createAccountMut.isPending}
              >
                {createAccountMut.isPending ? t('common.loading') : t('common.next')}
              </button>
            </>
          )}

          {step === 'fiscal_year' && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('onboarding.fy_title')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('onboarding.fy_subtitle')}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">{t('onboarding.fy_label')}</label>
                <input
                  className="input"
                  value={fyLabel}
                  onChange={(e) => { setFyLabel(e.target.value); setError(''); }}
                  placeholder="2025-2026"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">{t('onboarding.fy_start_month')}</label>
                  <select
                    className="input"
                    value={fyStartMonth}
                    onChange={(e) => setFyStartMonth(parseInt(e.target.value))}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{t(`months.${m}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">{t('onboarding.fy_start_year')}</label>
                  <input
                    className="input"
                    type="number"
                    value={fyStartYear}
                    onChange={(e) => setFyStartYear(parseInt(e.target.value))}
                    min={2020}
                    max={2030}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  {t('onboarding.opening_balance')}
                  <span className="text-slate-500 ml-1">({t('common.optional')})</span>
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="1032.86"
                />
                <p className="text-slate-500 text-xs mt-1">{t('onboarding.opening_balance_hint')}</p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3">
                <button
                  className="btn-ghost flex-1"
                  onClick={() => setStep('account')}
                >
                  {t('common.back')}
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={handleFiscalYearSubmit}
                  disabled={createFiscalYearMut.isPending}
                >
                  {createFiscalYearMut.isPending ? t('common.loading') : t('onboarding.finish')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
