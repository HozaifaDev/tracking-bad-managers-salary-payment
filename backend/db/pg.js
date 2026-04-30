const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

// Convert ? placeholders to $1, $2, ...
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Split multi-statement DDL strings (used by exec) on semicolons
function splitStatements(sql) {
  return sql.split(';').map((s) => s.trim()).filter(Boolean);
}

function makeAdapter(client) {
  return {
    type: 'pg',

    async all(sql, params = []) {
      const { rows } = await client.query(toPositional(sql), params);
      return rows;
    },

    async get(sql, params = []) {
      const { rows } = await client.query(toPositional(sql), params);
      return rows[0] ?? null;
    },

    async run(sql, params = []) {
      let q = toPositional(sql);
      if (/^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) q += ' RETURNING id';
      const result = await client.query(q, params);
      return { lastId: result.rows[0]?.id ?? null, changes: result.rowCount };
    },

    async exec(sql) {
      for (const stmt of splitStatements(sql)) {
        await client.query(stmt);
      }
    },

    async transaction(fn) {
      await client.query('BEGIN');
      try {
        await fn(makeAdapter(client));
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    },
  };
}

// Pool-level adapter: each call gets a connection from the pool
const adapter = {
  type: 'pg',

  async all(sql, params = []) {
    const { rows } = await getPool().query(toPositional(sql), params);
    return rows;
  },

  async get(sql, params = []) {
    const { rows } = await getPool().query(toPositional(sql), params);
    return rows[0] ?? null;
  },

  async run(sql, params = []) {
    let q = toPositional(sql);
    if (/^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) q += ' RETURNING id';
    const result = await getPool().query(q, params);
    return { lastId: result.rows[0]?.id ?? null, changes: result.rowCount };
  },

  async exec(sql) {
    for (const stmt of splitStatements(sql)) {
      await getPool().query(stmt);
    }
  },

  async transaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await fn(makeAdapter(client));
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

module.exports = { adapter };
