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

/**
 * Known CA bank operation type prefixes.
 * Order matters: longer matches first to avoid partial matching.
 */
const OPERATION_TYPES = [
  'ANNUL. OPE. DEBITRICES',
  'RETRAIT AU DISTRIBUTEUR',
  'VIREMENT EN VOTRE FAVEUR',
  'PAIEMENT PAR CARTE',
  'VIREMENT EMIS',
  'PRELEVEMENT',
];

/**
 * Split a CA bank label into operation type and detail.
 * e.g. "PAIEMENT PAR CARTE      X0475 CARREFOUR MARKET 92 CLIC 29/08"
 *   → { type: "Paiement carte", detail: "CARREFOUR MARKET 92 CLIC 29/08" }
 */
export function splitLabel(label: string): { type: string; detail: string } {
  const upper = label.toUpperCase();

  for (const prefix of OPERATION_TYPES) {
    if (upper.startsWith(prefix)) {
      // Strip the prefix and any trailing whitespace/card ref (X0475 etc.)
      let rest = label.slice(prefix.length).trim();
      // Remove card number pattern "X0475 " at the start of the detail
      rest = rest.replace(/^X\d{4}\s+/i, '');
      // Also handle newline-based multiline labels
      rest = rest.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
      return { type: friendlyType(prefix), detail: rest || label };
    }
  }

  // No known prefix — try splitting on first large whitespace gap
  const gapMatch = label.match(/^(\S+(?:\s\S+)*?)\s{3,}(.+)/);
  if (gapMatch) {
    return { type: gapMatch[1].trim(), detail: gapMatch[2].trim() };
  }

  return { type: '', detail: label };
}

function friendlyType(raw: string): string {
  switch (raw) {
    case 'PAIEMENT PAR CARTE':        return 'Carte';
    case 'VIREMENT EMIS':             return 'Virement émis';
    case 'VIREMENT EN VOTRE FAVEUR':  return 'Virement reçu';
    case 'PRELEVEMENT':               return 'Prélèvement';
    case 'RETRAIT AU DISTRIBUTEUR':   return 'Retrait DAB';
    case 'ANNUL. OPE. DEBITRICES':    return 'Annulation';
    default: return raw;
  }
}
