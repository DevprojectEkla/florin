export const MIGRATIONS: string[] = [
  // ── Migration 001 — initial schema ──────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    bank_name      TEXT NOT NULL DEFAULT 'Crédit Agricole',
    account_number TEXT,
    currency       TEXT NOT NULL DEFAULT 'EUR',
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fiscal_years (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    label           TEXT NOT NULL,
    start_year      INTEGER NOT NULL,
    start_month     INTEGER NOT NULL DEFAULT 9,
    opening_balance REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('income','fixed','variable','savings','transfer')),
    color      TEXT,
    icon       TEXT,
    is_system  INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS classification_rules (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern      TEXT NOT NULL,
    pattern_type TEXT NOT NULL DEFAULT 'contains',
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    priority     INTEGER NOT NULL DEFAULT 0,
    is_active    INTEGER NOT NULL DEFAULT 1,
    match_count  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    fiscal_year_id      INTEGER NOT NULL REFERENCES fiscal_years(id),
    filename            TEXT NOT NULL,
    account_number_raw  TEXT,
    balance_at_import   REAL,
    period_from         TEXT,
    period_to           TEXT,
    rows_in_file        INTEGER,
    rows_imported       INTEGER,
    rows_skipped        INTEGER,
    rows_conflicted     INTEGER,
    imported_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    fiscal_year_id  INTEGER NOT NULL REFERENCES fiscal_years(id),
    import_batch_id INTEGER REFERENCES import_batches(id),
    date            TEXT NOT NULL,
    label           TEXT NOT NULL,
    label_clean     TEXT,
    debit           REAL,
    credit          REAL,
    category_id     INTEGER REFERENCES categories(id),
    is_out_of_budget INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    is_reviewed     INTEGER NOT NULL DEFAULT 0,
    dedup_hash      TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_fy       ON transactions(fiscal_year_id);
  CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_tx_reviewed ON transactions(is_reviewed);

  CREATE TABLE IF NOT EXISTS monthly_balances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    fiscal_year_id  INTEGER NOT NULL REFERENCES fiscal_years(id),
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    closing_balance REAL NOT NULL,
    is_locked       INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, year, month)
  );

  CREATE TABLE IF NOT EXISTS budget_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year_id  INTEGER NOT NULL REFERENCES fiscal_years(id),
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    monthly_amount  REAL NOT NULL,
    UNIQUE(fiscal_year_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS portfolio_vehicles (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
    name           TEXT NOT NULL,
    expected_yield REAL NOT NULL DEFAULT 0.08,
    cash_balance   REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS portfolio_positions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id  INTEGER NOT NULL REFERENCES portfolio_vehicles(id),
    name        TEXT NOT NULL,
    ticker      TEXT,
    asset_type  TEXT,
    sector      TEXT,
    description TEXT,
    risk_level  TEXT CHECK(risk_level IN ('stable','moyen','volatile','très volatile')),
    amount      REAL NOT NULL,
    fees        REAL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,

  // ── Migration 002 — dedicated auth table (SEC-01, SEC-02) ──────────────
  `
  CREATE TABLE IF NOT EXISTS auth_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    password_hash   TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until   TEXT
  );

  -- Migrate existing password from app_settings to auth_config
  INSERT OR IGNORE INTO auth_config (id, password_hash)
    SELECT 1, value FROM app_settings WHERE key = 'password_hash';

  -- Clean up old location
  DELETE FROM app_settings WHERE key = 'password_hash';
  `,

  // ── Migration 003 — add capital category type ───────────────────────────
  `
  -- Temporarily disable foreign keys for table restructuring
  PRAGMA foreign_keys=OFF;
  
  -- Drop old temp table if it exists from failed migration
  DROP TABLE IF EXISTS categories_new;
  
  -- Drop old constraint and recreate with capital type
  CREATE TABLE categories_new (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('income','fixed','variable','savings','transfer','capital')),
    color      TEXT,
    icon       TEXT,
    is_system  INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  INSERT INTO categories_new SELECT * FROM categories;
  DROP TABLE categories;
  ALTER TABLE categories_new RENAME TO categories;
  
  -- Re-enable foreign keys
  PRAGMA foreign_keys=ON;

  -- Add capital investment categories (INSERT OR IGNORE to avoid duplicates)
  INSERT OR IGNORE INTO categories (slug, label, type, color, icon, is_system, is_active, sort_order) VALUES
    ('capital.furniture', 'Mobilier', 'capital', '#8b5cf6', '🛋️', 0, 1, 600),
    ('capital.tech', 'Informatique & Électronique', 'capital', '#3b82f6', '💻', 0, 1, 601),
    ('capital.clothing', 'Vêtements', 'capital', '#ec4899', '👔', 0, 1, 602),
    ('capital.education', 'Études & Formation', 'capital', '#10b981', '📚', 0, 1, 603),
    ('capital.sports', 'Sport & Équipements', 'capital', '#f59e0b', '⚽', 0, 1, 604);
  `,

  // ── Migration 004 — ensure capital categories exist ──────────────────────
  `
  -- Insert capital categories if they don't exist (in case migration 003 didn't insert them)
  INSERT OR IGNORE INTO categories (slug, label, type, color, icon, is_system, is_active, sort_order) VALUES
    ('capital.furniture', 'Mobilier', 'capital', '#8b5cf6', '🛋️', 0, 1, 600),
    ('capital.tech', 'Informatique & Électronique', 'capital', '#3b82f6', '💻', 0, 1, 601),
    ('capital.clothing', 'Vêtements', 'capital', '#ec4899', '👔', 0, 1, 602),
    ('capital.education', 'Études & Formation', 'capital', '#10b981', '📚', 0, 1, 603),
    ('capital.sports', 'Sport & Équipements', 'capital', '#f59e0b', '⚽', 0, 1, 604);
  `,

  // ── Migration 005 — fix CHECK constraint to include capital ───────────────
  `
  -- Temporarily disable foreign keys for table restructuring
  PRAGMA foreign_keys=OFF;
  
  -- Drop old temp table if it exists from failed migration
  DROP TABLE IF EXISTS categories_temp;
  
  -- Recreate categories table with correct CHECK constraint including 'capital'
  CREATE TABLE categories_temp (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('income','fixed','variable','savings','transfer','capital')),
    color      TEXT,
    icon       TEXT,
    is_system  INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Copy existing data
  INSERT INTO categories_temp SELECT * FROM categories;
  
  -- Drop old table and rename
  DROP TABLE categories;
  ALTER TABLE categories_temp RENAME TO categories;
  
  -- Re-enable foreign keys
  PRAGMA foreign_keys=ON;

  -- Now insert capital categories
  INSERT OR IGNORE INTO categories (slug, label, type, color, icon, is_system, is_active, sort_order) VALUES
    ('capital.furniture', 'Mobilier', 'capital', '#8b5cf6', '🛋️', 0, 1, 600),
    ('capital.tech', 'Informatique & Électronique', 'capital', '#3b82f6', '💻', 0, 1, 601),
    ('capital.clothing', 'Vêtements', 'capital', '#ec4899', '👔', 0, 1, 602),
    ('capital.education', 'Études & Formation', 'capital', '#10b981', '📚', 0, 1, 603),
    ('capital.sports', 'Sport & Équipements', 'capital', '#f59e0b', '⚽', 0, 1, 604);
  `,

  // ── Migration 006 — add Gifts (Cadeaux) variable category ─────────────────
  `
  INSERT OR IGNORE INTO categories (slug, label, type, color, icon, is_system, is_active, sort_order) VALUES
    ('variable.gifts', 'Cadeaux', 'variable', '#f0abfc', '🎁', 0, 1, 38);
  `,

  // ── Migration 007 — seed portfolio vehicles from savings transactions ──────
  // Creates PEA, PEA-PME and CTO vehicles for each existing fiscal year, then
  // sets their cash_balance to the net amount transacted (debit - credit) so
  // the investments page reflects actual deposits already made.
  `
  -- Insert vehicles for every fiscal year (skip if already present for that FY+name)
  INSERT OR IGNORE INTO portfolio_vehicles (fiscal_year_id, name, expected_yield, cash_balance)
  SELECT
    fy.id,
    v.name,
    v.yield,
    COALESCE((
      SELECT SUM(t.debit) - COALESCE(SUM(t.credit), 0)
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.fiscal_year_id = fy.id AND c.slug = v.slug
    ), 0)
  FROM fiscal_years fy
  CROSS JOIN (
    SELECT 'PEA'     AS name, 'savings.pea'     AS slug, 0.09 AS yield UNION ALL
    SELECT 'PEA-PME' AS name, 'savings.pea_pme' AS slug, 0.07 AS yield UNION ALL
    SELECT 'CTO'     AS name, 'savings.cto'     AS slug, 0.08 AS yield
  ) v
  WHERE NOT EXISTS (
    SELECT 1 FROM portfolio_vehicles pv
    WHERE pv.fiscal_year_id = fy.id AND pv.name = v.name
  );
  `,

  // ── Migration 008 — fix PEA-PME misclassification & add Bourse Direct rules
  `
  -- Recategorise transactions towards account 00000002 (PEA-PME) that were
  -- incorrectly tagged as savings.pea
  UPDATE transactions
  SET category_id = (SELECT id FROM categories WHERE slug = 'savings.pea_pme')
  WHERE category_id = (SELECT id FROM categories WHERE slug = 'savings.pea')
    AND label LIKE '%00000002%';

  -- Add high-priority classification rules for Bourse Direct account numbers
  -- so future imports are routed correctly without manual intervention.
  INSERT OR IGNORE INTO classification_rules (pattern, pattern_type, category_id, priority, is_active)
  VALUES
    ('00000001',  'contains', (SELECT id FROM categories WHERE slug = 'savings.pea'),     120, 1),
    ('00000002',  'contains', (SELECT id FROM categories WHERE slug = 'savings.pea_pme'), 120, 1),
    ('PEA PME',   'contains', (SELECT id FROM categories WHERE slug = 'savings.pea_pme'), 115, 1),
    ('PEA/PME',   'contains', (SELECT id FROM categories WHERE slug = 'savings.pea_pme'), 115, 1),
    ('versement PEA', 'contains', (SELECT id FROM categories WHERE slug = 'savings.pea'), 110, 1),
    ('Bourse direct', 'contains', (SELECT id FROM categories WHERE slug = 'savings.pea'),  80, 1),
    ('Bourse Direct', 'contains', (SELECT id FROM categories WHERE slug = 'savings.pea'),  80, 1);

  -- Refresh vehicle cash_balances now that categorisation is corrected
  UPDATE portfolio_vehicles
  SET cash_balance = COALESCE((
    SELECT SUM(t.debit) - COALESCE(SUM(t.credit), 0)
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.fiscal_year_id = portfolio_vehicles.fiscal_year_id
      AND c.slug = CASE portfolio_vehicles.name
                     WHEN 'PEA'     THEN 'savings.pea'
                     WHEN 'PEA-PME' THEN 'savings.pea_pme'
                     WHEN 'CTO'     THEN 'savings.cto'
                   END
  ), 0)
  WHERE name IN ('PEA', 'PEA-PME', 'CTO');
  `,

  // ── Migration 009 — add min/max budget range columns ──────────────────────
  `
ALTER TABLE budget_lines ADD COLUMN min_amount REAL;
ALTER TABLE budget_lines ADD COLUMN max_amount REAL;
`,
  // ── Migration 010 (accidental duplicate of 009) — intentionally a no-op ───
  // This used to repeat the ALTER TABLEs above, which fails with "duplicate
  // column name" on a fresh database. Existing databases already applied it,
  // so the slot is kept (version numbers are positional) but does nothing.
  `
  SELECT 1;
  `,
  // ── Migration 010 — attributed_month for payroll assignment ──────────────
  // Allows manually tagging a salary transaction to a specific month (YYYY-MM)
  // so the budget income calculation uses the intended month rather than the
  // transaction date. Nullable — when NULL the day-based heuristic applies.
  `
  ALTER TABLE transactions ADD COLUMN attributed_month TEXT;
  `,

  // ── Migration 012 — import history ───────────────────────────────────────
  // tx_from / tx_to: first and last transaction date actually found in the
  // file (period_from/to hold the bank's header text and may differ).
  // stored_path: copy of the imported file, relative to the app data dir.
  `
  ALTER TABLE import_batches ADD COLUMN tx_from TEXT;
  ALTER TABLE import_batches ADD COLUMN tx_to TEXT;
  ALTER TABLE import_batches ADD COLUMN stored_path TEXT;
  `,
];
