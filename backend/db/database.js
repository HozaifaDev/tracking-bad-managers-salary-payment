/**
 * Single shared SQLite connection using Node's built-in node:sqlite (no native addon).
 * Avoids Windows node-gyp / prebuild issues with better-sqlite3.
 *
 * Requires Node.js >= 22.5 (DatabaseSync).
 */
const path = require('path');
const { runMigrations } = require('./migrations');

let dbInstance = null;

function getSqlite() {
  try {
    return require('node:sqlite');
  } catch (e) {
    const err = new Error(
      'node:sqlite is not available. Install Node.js 22.5 or newer (LTS 22.x or current). ' +
        'On Windows, `nvm install 22` or download from https://nodejs.org/',
    );
    err.cause = e;
    throw err;
  }
}

function getDbPath() {
  const raw = process.env.DB_PATH || './tracker.db';
  const name = raw.replace(/^\.\//, '');
  return path.resolve(__dirname, '..', name);
}

function getDatabase() {
  if (!dbInstance) {
    const { DatabaseSync } = getSqlite();
    const dbPath = getDbPath();
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    runMigrations(dbInstance);
  }
  return dbInstance;
}

module.exports = { getDatabase, getDbPath };
