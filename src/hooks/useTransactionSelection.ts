import { useState, useCallback, useMemo, useEffect } from 'react';

export function useTransactionSelection<T extends { id: number }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clear selection when items change significantly (e.g., filter applied)
  const itemIds = useMemo(() => new Set(items.map(item => item.id)), [items]);
  
  useEffect(() => {
    // Remove selected IDs that are no longer in the current item list
    setSelectedIds(prev => {
      const next = new Set<number>();
      prev.forEach(id => {
        if (itemIds.has(id)) {
          next.add(id);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [itemIds]);

  // Toggle single item
  const toggleItem = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(item => item.id)));
  }, [items]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Check if all visible items are selected
  const isAllSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every(item => selectedIds.has(item.id));
  }, [items, selectedIds]);

  // Check if some (but not all) visible items are selected
  const isSomeSelected = useMemo(() => {
    if (items.length === 0) return false;
    const count = items.filter(item => selectedIds.has(item.id)).length;
    return count > 0 && count < items.length;
  }, [items, selectedIds]);

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(item.id));
  }, [items, selectedIds]);

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isSelected: (id: number) => selectedIds.has(id),
    toggleItem,
    selectAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  };
}
