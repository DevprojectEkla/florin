import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFirstAccount,
  getActiveFiscalYear,
  createAccount,
  createFiscalYear,
  isOnboardingComplete,
  type CreateAccountInput,
  type CreateFiscalYearInput,
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
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

export function useCreateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFiscalYearInput) => createFiscalYear(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-year'] });
      qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}
