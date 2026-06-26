import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRules, createRule, updateRule, deleteRule, reclassifyUnclassified, type CreateRuleInput, type UpdateRuleInput } from '../db/rules';

export function useRules() {
  return useQuery({ queryKey: ['rules'], queryFn: getRules });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRule(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateRuleInput }) => updateRule(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); },
  });
}

export function useReclassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reclassifyUnclassified(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['aggregates'] });
    },
  });
}
