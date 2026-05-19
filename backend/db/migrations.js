const fs = require('fs');
const path = require('path');

function loadConfigJson() {
  try {
    const p = path.resolve(__dirname, '../../config.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return {};
  }
}

// Convert legacy config.json shape → generic work_types array
function configToWorkTypes(config) {
  const wt = [];
  const groups = config.groups || {};
  for (const [name, g] of Object.entries(groups)) {
    wt.push({ name, rate_type: 'hourly', rate: Number(g.rate_per_hour) || 0, color: g.color || '#6366f1' });
  }
  const pc = config.private_courses || {};
  if (pc.default_hourly_rate || pc.default_split_instructor) {
    wt.push({
      name: 'Private Course',
      rate_type: 'hourly',
      rate: Number(pc.default_hourly_rate) || 0,
      color: '#8b5cf6',
    });
  }
  const diplomas = config.diplomas || {};
  for (const [trackName, t] of Object.entries(diplomas)) {
    wt.push({
      name: `Diploma: ${trackName}`,
      rate_type: 'milestone',
      rate: 0,
      color: t.color || '#f59e0b',
    });
  }
  return wt;
}

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
    CREATE TABLE IF NOT EXISTS clients (
      id                   ${pk},
      user_id              INTEGER NOT NULL,
      name                 TEXT NOT NULL,
      currency             TEXT NOT NULL DEFAULT 'EGP',
      work_cycle_start_day INTEGER NOT NULL DEFAULT 25,
      config_json          TEXT NOT NULL DEFAULT '{}',
      is_default           INTEGER NOT NULL DEFAULT 0,
      created_at           ${ts}
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                ${pk},
      user_id           INTEGER NOT NULL DEFAULT 1,
      client_id         INTEGER,
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
      client_id  INTEGER,
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
      client_id       INTEGER,
      track           TEXT NOT NULL,
      milestone       TEXT NOT NULL,
      completed       INTEGER DEFAULT 0,
      completion_date TEXT,
      payout_earned   REAL DEFAULT 0,
      session_id      INTEGER,
      UNIQUE(user_id, track, milestone)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS alert_settings (
      id             ${pk},
      user_id        INTEGER NOT NULL UNIQUE,
      alert_email    TEXT NOT NULL,
      threshold_days INTEGER NOT NULL DEFAULT 7,
      enabled        INTEGER NOT NULL DEFAULT 1,
      last_alerted_at TEXT
    )
  `);

  // Add billing columns to users table (idempotent)
  const userAlterations = [
    "ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'",
    'ALTER TABLE users ADD COLUMN ls_customer_id TEXT',
    'ALTER TABLE users ADD COLUMN ls_subscription_id TEXT',
    'ALTER TABLE users ADD COLUMN ls_subscription_status TEXT',
    'ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0',
  ];
  for (const sql of userAlterations) {
    try { await db.exec(sql); } catch (_) { /* already exists */ }
  }

  // Mark existing users who already have clients as onboarded so they aren't
  // redirected to the onboarding wizard on deploy.
  try {
    await db.exec(`
      UPDATE users SET onboarding_completed = 1
      WHERE onboarding_completed = 0
        AND id IN (SELECT DISTINCT user_id FROM clients)
    `);
  } catch (_) { /* clients table may not exist yet on a fresh DB */ }

  // Add user_id columns to existing tables if they don't exist yet (idempotent)
  // These are required for multi-user support but may be missing in old DBs
  const userIdAlterations = [
    'ALTER TABLE sessions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE payments ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE sync_log ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  ];
  for (const sql of userIdAlterations) {
    try { await db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // Add client_id columns to existing tables if they don't exist yet (idempotent)
  const alterations = [
    'ALTER TABLE sessions ADD COLUMN client_id INTEGER',
    'ALTER TABLE payments ADD COLUMN client_id INTEGER',
    'ALTER TABLE diploma_progress ADD COLUMN client_id INTEGER',
    'ALTER TABLE clients ADD COLUMN payment_due_start_day INTEGER DEFAULT 1',
    'ALTER TABLE clients ADD COLUMN payment_due_end_day INTEGER DEFAULT 5',
  ];
  for (const sql of alterations) {
    try { await db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_salary_month ON sessions(salary_month)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_uid_ceid ON sessions(user_id, calendar_event_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)',
    'CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id)',
  ];
  for (const idx of indexes) {
    try { await db.exec(idx); } catch (_) { /* already exists */ }
  }

  // Data migration: create a Default client for each user that doesn't have one yet,
  // then assign all orphaned sessions/payments to that client.
  await seedDefaultClients(db);
}

async function seedDefaultClients(db) {
  const config = loadConfigJson();
  const workTypes = configToWorkTypes(config);
  const configJson = JSON.stringify({
    timezone: config.timezone || 'UTC',
    currency: config.currency || 'EGP',
    work_cycle_start_day: Number(config.work_cycle_start_day) || 25,
    work_types: workTypes,
  });

  const users = await db.all('SELECT id FROM users', []);

  for (const u of users) {
    // Check if user already has a default client
    const existing = await db.get(
      'SELECT id FROM clients WHERE user_id = ? AND is_default = 1',
      [u.id],
    );
    if (existing) continue;

    // Create Default client
    const { lastId } = await db.run(
      `INSERT INTO clients (user_id, name, currency, work_cycle_start_day, config_json, is_default)
       VALUES (?, 'Default', ?, ?, ?, 1)`,
      [
        u.id,
        config.currency || 'EGP',
        Number(config.work_cycle_start_day) || 25,
        configJson,
      ],
    );

    // Assign all existing orphaned sessions to this client
    await db.run(
      'UPDATE sessions SET client_id = ? WHERE user_id = ? AND client_id IS NULL',
      [lastId, u.id],
    );
    await db.run(
      'UPDATE payments SET client_id = ? WHERE user_id = ? AND client_id IS NULL',
      [lastId, u.id],
    );
    await db.run(
      'UPDATE diploma_progress SET client_id = ? WHERE user_id = ? AND client_id IS NULL',
      [lastId, u.id],
    );
  }
}

module.exports = { runMigrations };
