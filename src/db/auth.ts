import { getDb } from './client';

// ─── Migration for auth table (added in PR-03) ────────────────────────────────
// This runs as migration version 2 — see migrations.ts

export async function getPasswordHash(): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ password_hash: string }[]>(
    'SELECT password_hash FROM auth_config LIMIT 1'
  );
  return rows[0]?.password_hash ?? null;
}

export async function setPasswordHash(hash: string): Promise<void> {
  const db = await getDb();
  // Upsert — there should only ever be one row
  await db.execute(
    `INSERT INTO auth_config (id, password_hash, failed_attempts, lockout_until)
     VALUES (1, ?, 0, NULL)
     ON CONFLICT(id) DO UPDATE SET password_hash = ?`,
    [hash, hash]
  );
}

export async function getFailedAttempts(): Promise<{ count: number; lockoutUntil: string | null }> {
  const db = await getDb();
  const rows = await db.select<{ failed_attempts: number; lockout_until: string | null }[]>(
    'SELECT failed_attempts, lockout_until FROM auth_config WHERE id = 1'
  );
  if (rows.length === 0) return { count: 0, lockoutUntil: null };
  return { count: rows[0].failed_attempts, lockoutUntil: rows[0].lockout_until };
}

export async function recordFailedAttempt(maxAttempts: number, lockoutSeconds: number): Promise<{ locked: boolean; remainingAttempts: number }> {
  const db = await getDb();
  // Increment failed_attempts
  await db.execute(
    'UPDATE auth_config SET failed_attempts = failed_attempts + 1 WHERE id = 1'
  );
  const rows = await db.select<{ failed_attempts: number }[]>(
    'SELECT failed_attempts FROM auth_config WHERE id = 1'
  );
  const attempts = rows[0]?.failed_attempts ?? 0;

  if (attempts >= maxAttempts) {
    const lockoutUntil = new Date(Date.now() + lockoutSeconds * 1000).toISOString();
    await db.execute(
      'UPDATE auth_config SET lockout_until = ? WHERE id = 1',
      [lockoutUntil]
    );
    return { locked: true, remainingAttempts: 0 };
  }

  return { locked: false, remainingAttempts: maxAttempts - attempts };
}

export async function resetFailedAttempts(): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE auth_config SET failed_attempts = 0, lockout_until = NULL WHERE id = 1'
  );
}

export async function isLockedOut(): Promise<{ locked: boolean; secondsRemaining: number }> {
  const db = await getDb();
  const rows = await db.select<{ lockout_until: string | null }[]>(
    'SELECT lockout_until FROM auth_config WHERE id = 1'
  );
  const lockoutUntil = rows[0]?.lockout_until;
  if (!lockoutUntil) return { locked: false, secondsRemaining: 0 };

  const remaining = Math.ceil((new Date(lockoutUntil).getTime() - Date.now()) / 1000);
  if (remaining <= 0) {
    // Lockout expired — reset
    await resetFailedAttempts();
    return { locked: false, secondsRemaining: 0 };
  }
  return { locked: true, secondsRemaining: remaining };
}
