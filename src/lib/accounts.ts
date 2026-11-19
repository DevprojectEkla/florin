/**
 * Pure helpers for multi-account support (no DB access, unit-testable).
 */

/**
 * Normalise a bank account number for comparison: keep letters/digits only,
 * uppercase, and drop leading zeros ("00012345678" and "12345678" match).
 * Returns '' when nothing usable is left.
 */
export function normalizeAccountNumber(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
    .replace(/^0+/, '');
}

/** True when both numbers are non-empty and refer to the same account. */
export function sameAccountNumber(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeAccountNumber(a);
  return na !== '' && na === normalizeAccountNumber(b);
}

/**
 * `transactions.dedup_hash` is UNIQUE across the whole table, so two accounts
 * holding an identical operation (same day, label and amount) would collide.
 *
 * To stay backward compatible, the legacy (first-created) account keeps the
 * historical un-prefixed hash, so re-importing old files still dedups.
 * Every other account gets an `a<id>:` prefix.
 */
export function scopeDedupHash(
  hash: string,
  accountId: number,
  legacyAccountId: number | null
): string {
  return legacyAccountId === null || accountId === legacyAccountId
    ? hash
    : `a${accountId}:${hash}`;
}
