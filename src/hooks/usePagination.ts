import { useState, useEffect } from 'react';

interface UsePaginationOptions {
  storageKey: string;
  defaultItemsPerPage?: number;
}

export function usePagination({
  storageKey,
  defaultItemsPerPage = 50,
}: UsePaginationOptions) {
  // Load items per page from localStorage
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const stored = localStorage.getItem(`${storageKey}:itemsPerPage`);
    return stored ? parseInt(stored) : defaultItemsPerPage;
  });

  const [currentPage, setCurrentPage] = useState(1);

  // Persist items per page to localStorage
  useEffect(() => {
    localStorage.setItem(`${storageKey}:itemsPerPage`, itemsPerPage.toString());
  }, [itemsPerPage, storageKey]);

  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Get paginated data
  const getPaginatedData = <T,>(data: T[]): T[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  return {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    getPaginatedData,
  };
}
