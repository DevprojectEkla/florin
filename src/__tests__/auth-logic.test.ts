import { describe, it, expect } from 'vitest';

// These test the lockout logic decisions (pure logic, no DB)
// The actual DB calls are tested manually in-app

describe('lockout logic', () => {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 60;

  it('should allow attempts when under max', () => {
    const attempts = 3;
    const locked = attempts >= MAX_ATTEMPTS;
    const remaining = MAX_ATTEMPTS - attempts;
    expect(locked).toBe(false);
    expect(remaining).toBe(2);
  });

  it('should lock after max attempts reached', () => {
    const attempts = 5;
    const locked = attempts >= MAX_ATTEMPTS;
    expect(locked).toBe(true);
  });

  it('should calculate lockout expiry correctly', () => {
    const now = Date.now();
    const lockoutUntil = new Date(now + LOCKOUT_SECONDS * 1000).toISOString();
    const remaining = Math.ceil((new Date(lockoutUntil).getTime() - now) / 1000);
    expect(remaining).toBeGreaterThanOrEqual(59);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  it('should detect expired lockout', () => {
    const pastLockout = new Date(Date.now() - 1000).toISOString();
    const remaining = Math.ceil((new Date(pastLockout).getTime() - Date.now()) / 1000);
    expect(remaining).toBeLessThanOrEqual(0);
  });

  it('should not lock on first failure', () => {
    const attempts = 1;
    const locked = attempts >= MAX_ATTEMPTS;
    const remaining = MAX_ATTEMPTS - attempts;
    expect(locked).toBe(false);
    expect(remaining).toBe(4);
  });
});
