const path = require('path');

let dbInstance = null;

function getSqlite() {
  try {
    return require('node:sqlite');
  } catch (e) {
    throw new Error(
      'node:sqlite unavailable. Install Node.js >= 22.5 or set DATABASE_URL to use PostgreSQL.',
    );
  }
}

function getDbPath() {
  const raw = process.env.DB_PATH || './tracker.db';
  return path.resolve(__dirname, '..', raw.replace(/^\.\//, ''));
}

function getRaw() {
  if (!dbInstance) {
    const { DatabaseSync } = getSqlite();
    dbInstance = new DatabaseSync(getDbPath());
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

const adapter = {
  type: 'sqlite',

  async all(sql, params = []) {
    return getRaw().prepare(sql).all(...params);
  },

  async get(sql, params = []) {
    return getRaw().prepare(sql).get(...params) ?? null;
  },

  async run(sql, params = []) {
    const info = getRaw().prepare(sql).run(...params);
    return { lastId: Number(info.lastInsertRowid), changes: Number(info.changes) };
  },

  async exec(sql) {
    getRaw().exec(sql);
  },

  async transaction(fn) {
    getRaw().exec('BEGIN IMMEDIATE');
    try {
      await fn(adapter);
      getRaw().exec('COMMIT');
    } catch (e) {
      try { getRaw().exec('ROLLBACK'); } catch (_) { /* ignore */ }
      throw e;
    }
  },
};

module.exports = { adapter, getDbPath };
