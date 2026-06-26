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
];
