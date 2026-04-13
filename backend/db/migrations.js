/**
 * SQLite schema for Hours & Salary Tracker.
 * All statements use IF NOT EXISTS so startup is idempotent.
 * Compatible with node:sqlite DatabaseSync (same as better-sqlite3-style .exec / .prepare).
 */
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      calendar_event_id TEXT UNIQUE,
      title             TEXT NOT NULL,
      date              TEXT NOT NULL,
      day_of_week       TEXT,
      start_time        TEXT,
      end_time          TEXT,
      duration_hours    REAL NOT NULL,
      category          TEXT NOT NULL,
      sub_category      TEXT,
      milestone         TEXT,
      is_milestone_complete INTEGER DEFAULT 0,
      rate_applied      REAL DEFAULT 0,
      earnings          REAL DEFAULT 0,
      salary_month      TEXT,
      cycle_start       TEXT,
      cycle_end         TEXT,
      note              TEXT,
      flagged           INTEGER DEFAULT 0,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      note       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at      TEXT DEFAULT (datetime('now')),
      range_from     TEXT,
      range_to       TEXT,
      events_fetched INTEGER DEFAULT 0,
      new_sessions   INTEGER DEFAULT 0,
      skipped        INTEGER DEFAULT 0,
      status         TEXT,
      error_message  TEXT
    );

    CREATE TABLE IF NOT EXISTS diploma_progress (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      track            TEXT NOT NULL,
      milestone        TEXT NOT NULL,
      completed        INTEGER DEFAULT 0,
      completion_date  TEXT,
      payout_earned    REAL DEFAULT 0,
      session_id       INTEGER REFERENCES sessions(id),
      UNIQUE(track, milestone)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_salary_month ON sessions(salary_month);
    CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
  `);
}

module.exports = { runMigrations };
