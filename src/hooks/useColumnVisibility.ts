import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'florin_column_visibility_';

export function useColumnVisibility(
  tableId: string,
  defaultVisibleColumns: string[]
) {
  const storageKey = STORAGE_KEY_PREFIX + tableId;

  // Initialize from localStorage or defaults
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch (err) {
      console.error('Failed to load column visibility from localStorage:', err);
    }
    return new Set(defaultVisibleColumns);
  });

  // Persist to localStorage whenever visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleColumns)));
    } catch (err) {
      console.error('Failed to save column visibility to localStorage:', err);
    }
  }, [visibleColumns, storageKey]);

  // Toggle column visibility
  const toggleColumn = useCallback((columnId: string, visible: boolean) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (visible) {
        next.add(columnId);
      } else {
        // Prevent hiding the last visible column
        if (next.size > 1) {
          next.delete(columnId);
        }
      }
      return next;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setVisibleColumns(new Set(defaultVisibleColumns));
  }, [defaultVisibleColumns]);

  return {
    visibleColumns,
    toggleColumn,
    resetToDefaults,
  };
}
