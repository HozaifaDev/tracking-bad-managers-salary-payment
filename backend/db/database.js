const { runMigrations } = require('./migrations');

let dbAdapter = null;

async function getDatabase() {
  if (dbAdapter) return dbAdapter;

  if (process.env.DATABASE_URL) {
    const { adapter } = require('./pg');
    dbAdapter = adapter;
  } else {
    const { adapter } = require('./sqlite');
    dbAdapter = adapter;
  }

  await runMigrations(dbAdapter);
  return dbAdapter;
}

// Legacy sync-compatible helper for backward compatibility during migration
function getDbPath() {
  try {
    return require('./sqlite').getDbPath();
  } catch (_) {
    return null;
  }
}

module.exports = { getDatabase, getDbPath };
