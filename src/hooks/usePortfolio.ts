import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVehicles, createVehicle, updateVehicle, deleteVehicle,
  getPositions, getAllPositions, createPosition, updatePosition, deletePosition,
  getRiskBreakdown, getVehicleSummaries,
} from '../db/portfolio';

export function useVehicles(fyId: number | undefined) {
  return useQuery({ queryKey: ['portfolio', 'vehicles', fyId], queryFn: () => getVehicles(fyId!), enabled: !!fyId });
}

export function usePositions(vehicleId: number | undefined) {
  return useQuery({ queryKey: ['portfolio', 'positions', vehicleId], queryFn: () => getPositions(vehicleId!), enabled: !!vehicleId });
}

export function useAllPositions(fyId: number | undefined) {
  return useQuery({ queryKey: ['portfolio', 'all-positions', fyId], queryFn: () => getAllPositions(fyId!), enabled: !!fyId });
}

export function useRiskBreakdown(fyId: number | undefined) {
  return useQuery({ queryKey: ['portfolio', 'risk', fyId], queryFn: () => getRiskBreakdown(fyId!), enabled: !!fyId });
}

export function useVehicleSummaries(fyId: number | undefined) {
  return useQuery({ queryKey: ['portfolio', 'summaries', fyId], queryFn: () => getVehicleSummaries(fyId!), enabled: !!fyId });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createVehicle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateVehicle>[1] }) => updateVehicle(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPosition,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updatePosition>[1] }) => updatePosition(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePosition,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); },
  });
}
