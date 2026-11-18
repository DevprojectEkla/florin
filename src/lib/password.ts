export const MIN_PASSWORD_LENGTH = 8;

export type PasswordChangeError =
  | 'EMPTY_CURRENT'
  | 'TOO_SHORT'
  | 'MISMATCH'
  | 'SAME_AS_CURRENT';

/**
 * Validate the inputs of a "change password" form (pure, no I/O).
 * Returns the first problem found, or null when the inputs are acceptable.
 */
export function validatePasswordChange(
  current: string,
  next: string,
  confirm: string
): PasswordChangeError | null {
  if (current.length === 0) return 'EMPTY_CURRENT';
  if (next.length < MIN_PASSWORD_LENGTH) return 'TOO_SHORT';
  if (next !== confirm) return 'MISMATCH';
  if (next === current) return 'SAME_AS_CURRENT';
  return null;
}
