import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  getPasswordHash,
  setPasswordHash,
  isLockedOut,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../db/auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

interface Props {
  mode: 'setup' | 'locked';
  onUnlocked: () => void;
}

export default function LockScreen({ mode, onUnlocked }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [locked, setLocked]     = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Check lockout state on mount and tick countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function checkLockout() {
      const lockState = await isLockedOut();
      if (lockState.locked) {
        setLocked(true);
        setCountdown(lockState.secondsRemaining);
        timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setLocked(false);
              setError('');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    if (mode === 'locked') {
      checkLockout();
    }

    return () => { if (timer) clearInterval(timer); };
  }, [mode]);

  async function handleSetup() {
    if (password.length < 8) { setError(t('auth.error_too_short')); return; }
    if (password !== confirm) { setError(t('auth.error_mismatch')); return; }
    setLoading(true);
    try {
      const hash = await invoke<string>('hash_password', { password });
      await setPasswordHash(hash);
      onUnlocked();
    } catch (e) {
      if (import.meta.env.DEV) console.error('Setup error:', e);
      setError(`${t('common.error')}: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    if (!password || locked) return;
    setLoading(true);
    try {
      // Check lockout
      const lockState = await isLockedOut();
      if (lockState.locked) {
        setLocked(true);
        setCountdown(lockState.secondsRemaining);
        setLoading(false);
        return;
      }

      const hash = await getPasswordHash();
      if (!hash) { setError(t('auth.error_wrong')); setLoading(false); return; }

      const ok = await invoke<boolean>('verify_password', { password, hash });
      if (ok) {
        await resetFailedAttempts();
        onUnlocked();
      } else {
        const result = await recordFailedAttempt(MAX_ATTEMPTS, LOCKOUT_SECONDS);
        if (result.locked) {
          setLocked(true);
          setCountdown(LOCKOUT_SECONDS);
          setError(t('auth.error_locked_out', { seconds: LOCKOUT_SECONDS }));
        } else {
          setError(t('auth.error_wrong_attempts', { remaining: result.remainingAttempts }));
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('Unlock error:', e);
      setError(`${t('common.error')}: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const isSetup = mode === 'setup';

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-florin-400 text-5xl mb-2">ƒ</div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.name')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {isSetup ? t('auth.setup_title') : t('auth.title')}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isSetup ? t('auth.setup_subtitle') : t('auth.subtitle')}
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.password_label')}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && (isSetup ? handleSetup() : handleUnlock())}
              disabled={locked}
              autoFocus
            />
          </div>

          {isSetup && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('auth.confirm_label')}</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {locked && (
            <p className="text-amber-400 text-sm">
              {t('auth.lockout_countdown', { seconds: countdown })}
            </p>
          )}

          <button
            className="btn-primary w-full"
            onClick={isSetup ? handleSetup : handleUnlock}
            disabled={loading || locked}
          >
            {loading ? t('common.loading') : isSetup ? t('auth.create') : t('auth.unlock')}
          </button>
        </div>
      </div>
    </div>
  );
}
