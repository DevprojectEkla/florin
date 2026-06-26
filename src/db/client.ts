import Database from '@tauri-apps/plugin-sql';
import { MIGRATIONS } from './migrations';
import { CATEGORY_SEEDS, RULE_SEEDS } from './seeds';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:florin.db');
  // These PRAGMAs must be set per-connection — SQLite resets them on reconnect.
  // WAL improves concurrent read performance; foreign_keys enforces referential integrity.
  await _db.execute('PRAGMA journal_mode=WAL');
  await _db.execute('PRAGMA foreign_keys=ON');
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: Database): Promise<void> {
  // Ensure migration tracker exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.select<{ version: number }[]>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (appliedSet.has(version)) continue;

    await db.execute(MIGRATIONS[i]);
    await db.execute(
      'INSERT INTO schema_migrations (version) VALUES (?)',
      [version]
    );

    // Seed categories and rules on first migration
    if (version === 1) {
      await seedCategories(db);
      await seedSettings(db);
    }
  }
}

async function seedCategories(db: Database): Promise<void> {
  for (const cat of CATEGORY_SEEDS) {
    await db.execute(
      `INSERT OR IGNORE INTO categories
        (slug, label, type, color, icon, is_system, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [cat.slug, cat.label_fr, cat.type, cat.color, cat.icon, cat.is_system, cat.sort_order]
    );
  }

  // Seed classification rules
  for (const rule of RULE_SEEDS) {
    const cat = await db.select<{ id: number }[]>(
      'SELECT id FROM categories WHERE slug = ?',
      [rule.slug]
    );
    if (cat.length === 0) continue;
    await db.execute(
      `INSERT OR IGNORE INTO classification_rules
        (pattern, pattern_type, category_id, priority, is_active)
       VALUES (?, 'contains', ?, ?, 1)`,
      [rule.pattern, cat[0].id, rule.priority]
    );
  }
}

async function seedSettings(db: Database): Promise<void> {
  const defaults: Record<string, string> = {
    fiscal_year_start_month: '9',
    app_version: '0.1.0',
    default_language: 'fr',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.execute(
      'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }
}
