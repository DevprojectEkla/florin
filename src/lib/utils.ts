/**
 * Convert a label into a URL/slug-safe identifier.
 * - Lowercases
 * - Strips diacritics (NFD decomposition)
 * - Replaces non-alphanumeric runs with underscore
 * - Trims leading/trailing underscores
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate a SHA-256-like dedup hash for a transaction.
 * Uses a simple string concatenation for now — the actual SHA is computed at import time.
 * This is the canonical key shape: date|label|amount
 */
export function dedupKey(date: string, label: string, amount: number): string {
  return `${date}|${label.trim()}|${amount.toFixed(2)}`;
}
