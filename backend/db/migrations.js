async function runMigrations(db) {
  const pg = db.type === 'pg';
  const pk = pg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const ts = pg ? 'TIMESTAMPTZ DEFAULT NOW()' : "TEXT DEFAULT (datetime('now'))";

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id       ${pk},
      email    TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name     TEXT,
      created_at ${ts}
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                ${pk},
      user_id           INTEGER NOT NULL DEFAULT 1,
      calendar_event_id TEXT NOT NULL,
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
      created_at        ${ts},
      updated_at        ${ts}
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id         ${pk},
      user_id    INTEGER NOT NULL DEFAULT 1,
      date       TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      note       TEXT,
      created_at ${ts}
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id             ${pk},
      user_id        INTEGER NOT NULL DEFAULT 1,
      synced_at      ${ts},
      range_from     TEXT,
      range_to       TEXT,
      events_fetched INTEGER DEFAULT 0,
      new_sessions   INTEGER DEFAULT 0,
      skipped        INTEGER DEFAULT 0,
      status         TEXT,
      error_message  TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS diploma_progress (
      id              ${pk},
      user_id         INTEGER NOT NULL DEFAULT 1,
      track           TEXT NOT NULL,
      milestone       TEXT NOT NULL,
      completed       INTEGER DEFAULT 0,
      completion_date TEXT,
      payout_earned   REAL DEFAULT 0,
      session_id      INTEGER,
      UNIQUE(user_id, track, milestone)
    )
  `);

  // Indexes — ignore errors if they already exist
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_salary_month ON sessions(salary_month)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_uid_ceid ON sessions(user_id, calendar_event_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)',
  ];

  for (const idx of indexes) {
    try {
      await db.exec(idx);
    } catch (_) { /* already exists */ }
  }
}

module.exports = { runMigrations };
