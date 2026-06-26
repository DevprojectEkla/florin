import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllCategories,
  getActiveCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  reorderCategories,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '../db/categories';

const KEYS = {
  all:    ['categories', 'all']    as const,
  active: ['categories', 'active'] as const,
};

export function useAllCategories() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn:  getAllCategories,
  });
}

export function useActiveCategories() {
  return useQuery({
    queryKey: KEYS.active,
    queryFn:  getActiveCategories,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => archiveCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderCategories(orderedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
