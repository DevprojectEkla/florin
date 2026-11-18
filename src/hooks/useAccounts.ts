import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFirstAccount,
  getActiveFiscalYear,
  createAccount,
  createFiscalYear,
  isOnboardingComplete,
  updateAccount,
  setFiscalYearOpeningBalance,
  type CreateAccountInput,
  type CreateFiscalYearInput,
  type UpdateAccountInput,
} from '../db/accounts';

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: isOnboardingComplete,
  });
}

export function useFirstAccount() {
  return useQuery({
    queryKey: ['account', 'first'],
    queryFn: getFirstAccount,
  });
}

export function useActiveFiscalYear(accountId: number | undefined) {
  return useQuery({
    queryKey: ['fiscal-year', 'active', accountId],
    queryFn: () => getActiveFiscalYear(accountId!),
    enabled: !!accountId,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAccountInput }) =>
      updateAccount(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useCreateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFiscalYearInput) => createFiscalYear(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-year'] });
      qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

/** Administrative: overwrite a fiscal year's opening balance (balance is anchored on it). */
export function useSetOpeningBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fiscalYearId, openingBalance }: { fiscalYearId: number; openingBalance: number | null }) =>
      setFiscalYearOpeningBalance(fiscalYearId, openingBalance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-year'] });
      qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}
