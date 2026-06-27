import type { TransactionWithCategory } from '../db/transactions';

export interface SearchQuery {
  exactPhrases: string[];
  includeWords: string[];
  excludeWords: string[];
  orGroups: string[][];
  amountFilters: AmountFilter[];
  categoryFilters: string[];
  dateFilters: string[];
}

interface AmountFilter {
  type: 'gt' | 'lt' | 'gte' | 'lte' | 'range';
  value: number;
  value2?: number; // For range
}

/**
 * Parse advanced search query with operators:
 * - "exact phrase" → exact match
 * - -word → exclude
 * - word1 OR word2 → OR logic
 * - >100, <50, >=100, <=50 → amount comparison
 * - 50..100 → amount range
 * - category:name → category filter
 * - date:YYYY-MM → date filter
 */
export function parseSearchQuery(query: string): SearchQuery {
  const result: SearchQuery = {
    exactPhrases: [],
    includeWords: [],
    excludeWords: [],
    orGroups: [],
    amountFilters: [],
    categoryFilters: [],
    dateFilters: [],
  };

  if (!query.trim()) {
    return result;
  }

  let remaining = query;

  // 1. Extract exact phrases "..."
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(query)) !== null) {
    result.exactPhrases.push(match[1].toLowerCase());
    remaining = remaining.replace(match[0], ' ');
  }

  // 2. Extract category filters: category:name
  const categoryRegex = /category:(\S+)/gi;
  while ((match = categoryRegex.exec(remaining)) !== null) {
    result.categoryFilters.push(match[1].toLowerCase());
    remaining = remaining.replace(match[0], ' ');
  }

  // 3. Extract date filters: date:YYYY-MM or date:YYYY-MM-DD
  const dateRegex = /date:(\d{4}-\d{2}(?:-\d{2})?)/gi;
  while ((match = dateRegex.exec(remaining)) !== null) {
    result.dateFilters.push(match[1]);
    remaining = remaining.replace(match[0], ' ');
  }

  // 4. Extract amount filters
  // Range: 50..100
  const rangeRegex = /(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)/g;
  while ((match = rangeRegex.exec(remaining)) !== null) {
    result.amountFilters.push({
      type: 'range',
      value: parseFloat(match[1]),
      value2: parseFloat(match[2]),
    });
    remaining = remaining.replace(match[0], ' ');
  }

  // Comparisons: >100, <50, >=100, <=50
  const compRegex = /(>=|<=|>|<)(\d+(?:\.\d+)?)/g;
  while ((match = compRegex.exec(remaining)) !== null) {
    const op = match[1];
    const value = parseFloat(match[2]);
    let type: AmountFilter['type'];
    
    if (op === '>') type = 'gt';
    else if (op === '<') type = 'lt';
    else if (op === '>=') type = 'gte';
    else type = 'lte';
    
    result.amountFilters.push({ type, value });
    remaining = remaining.replace(match[0], ' ');
  }

  // 5. Split remaining by spaces
  const tokens = remaining.split(/\s+/).filter(t => t.trim());

  // 6. Process tokens for OR, exclude, and include
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (!token) {
      i++;
      continue;
    }

    // Check for OR group
    if (i + 2 < tokens.length && tokens[i + 1]?.toUpperCase() === 'OR') {
      const orGroup = [token.toLowerCase()];
      let j = i + 2;
      
      orGroup.push(tokens[j].toLowerCase());
      j++;

      // Continue collecting OR terms
      while (j + 1 < tokens.length && tokens[j]?.toUpperCase() === 'OR') {
        orGroup.push(tokens[j + 1].toLowerCase());
        j += 2;
      }

      result.orGroups.push(orGroup);
      i = j;
      continue;
    }

    // Check for exclude
    if (token.startsWith('-') && token.length > 1) {
      result.excludeWords.push(token.substring(1).toLowerCase());
      i++;
      continue;
    }

    // Regular include word
    if (token) {
      result.includeWords.push(token.toLowerCase());
    }
    i++;
  }

  return result;
}

/**
 * Apply parsed search query to filter transactions
 */
export function applySearchQuery(
  transactions: TransactionWithCategory[],
  query: SearchQuery
): TransactionWithCategory[] {
  if (
    query.exactPhrases.length === 0 &&
    query.includeWords.length === 0 &&
    query.excludeWords.length === 0 &&
    query.orGroups.length === 0 &&
    query.amountFilters.length === 0 &&
    query.categoryFilters.length === 0 &&
    query.dateFilters.length === 0
  ) {
    return transactions;
  }

  return transactions.filter((tx) => {
    const searchText = `${tx.label} ${tx.label_clean ?? ''} ${tx.category_label ?? ''}`.toLowerCase();
    const amount = tx.debit ?? tx.credit ?? 0;

    // Exact phrases
    for (const phrase of query.exactPhrases) {
      if (!searchText.includes(phrase)) {
        return false;
      }
    }

    // Exclude words
    for (const word of query.excludeWords) {
      if (searchText.includes(word)) {
        return false;
      }
    }

    // Include words (AND logic)
    for (const word of query.includeWords) {
      if (!searchText.includes(word)) {
        return false;
      }
    }

    // OR groups
    for (const orGroup of query.orGroups) {
      const found = orGroup.some(word => searchText.includes(word));
      if (!found) {
        return false;
      }
    }

    // Amount filters
    for (const filter of query.amountFilters) {
      switch (filter.type) {
        case 'gt':
          if (!(amount > filter.value)) return false;
          break;
        case 'lt':
          if (!(amount < filter.value)) return false;
          break;
        case 'gte':
          if (!(amount >= filter.value)) return false;
          break;
        case 'lte':
          if (!(amount <= filter.value)) return false;
          break;
        case 'range':
          if (!(amount >= filter.value && amount <= (filter.value2 ?? filter.value))) return false;
          break;
      }
    }

    // Category filters
    for (const catFilter of query.categoryFilters) {
      const categoryLabel = (tx.category_label ?? '').toLowerCase();
      if (!categoryLabel.includes(catFilter)) {
        return false;
      }
    }

    // Date filters
    for (const dateFilter of query.dateFilters) {
      if (!tx.date.startsWith(dateFilter)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get search suggestions/hints for the current query
 */
export function getSearchHints(query: string): string[] {
  const hints: string[] = [];

  if (!query.trim()) {
    return [
      '"exact phrase" - Recherche exacte',
      '-word - Exclure un mot',
      'word1 OR word2 - L\'un ou l\'autre',
      '>100 - Montant supérieur à 100€',
      '<50 - Montant inférieur à 50€',
      '50..100 - Montant entre 50 et 100€',
      'category:alimentation - Dans une catégorie',
      'date:2026-06 - En juin 2026',
    ];
  }

  // Provide contextual hints based on what's being typed
  const lastWord = query.split(/\s+/).pop() || '';

  if (lastWord.startsWith('category:')) {
    hints.push('category:alimentation', 'category:transport', 'category:loisirs');
  } else if (lastWord.startsWith('date:')) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    hints.push(`date:${year}-${month}`, `date:${year}`, `date:${year-1}`);
  } else if (lastWord.match(/^\d/)) {
    hints.push('>100', '<50', '50..100');
  } else if (lastWord === '' || lastWord.match(/^\w/)) {
    hints.push('"phrase exacte"', 'mot1 OR mot2', '-exclure');
  }

  return hints.slice(0, 5);
}
