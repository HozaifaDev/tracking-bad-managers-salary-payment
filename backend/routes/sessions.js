const express = require('express');
const { getDatabase } = require('../db/database');
const { buildManualRawEvent } = require('../services/calculatorService');
const { applyRawEventsToDatabase } = require('../services/sessionSyncLogic');

const router = express.Router();

const SORTABLE = new Set([
  'date', 'title', 'category', 'duration_hours',
  'rate_applied', 'earnings', 'salary_month', 'flagged', 'id',
]);

function mapSession(r) {
  if (!r) return null;
  return {
    id: r.id,
    clientId: r.client_id,
    calendarEventId: r.calendar_event_id,
    title: r.title,
    date: r.date,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    durationHours: r.duration_hours,
    category: r.category,
    subCategory: r.sub_category,
    milestone: r.milestone,
    isMilestoneComplete: Boolean(r.is_milestone_complete),
    rateApplied: r.rate_applied,
    earnings: r.earnings,
    salaryMonth: r.salary_month,
    cycleStart: r.cycle_start,
    cycleEnd: r.cycle_end,
    note: r.note,
    flagged: Boolean(r.flagged),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function resolveClient(db, userId, clientId) {
  if (clientId) {
    const c = await db.get(
      'SELECT * FROM clients WHERE id = ? AND user_id = ?',
      [clientId, userId],
    );
    if (!c) {
      const err = new Error('Client not found');
      err.status = 404;
      throw err;
    }
    return c;
  }
  // Fall back to default client
  const def = await db.get(
    'SELECT * FROM clients WHERE user_id = ? AND is_default = 1',
    [userId],
  );
  if (!def) {
    const err = new Error('No default client found. Create a client first.');
    err.status = 400;
    throw err;
  }
  return def;
}

router.get('/', async (req, res) => {
  const db = await getDatabase();
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = ['user_id = ?'];
  const params = [userId];

  if (req.query.clientId) { conditions.push('client_id = ?'); params.push(Number(req.query.clientId)); }
  if (req.query.from)      { conditions.push('date >= ?'); params.push(req.query.from); }
  if (req.query.to)        { conditions.push('date <= ?'); params.push(req.query.to); }
  if (req.query.category)  { conditions.push('category = ?'); params.push(req.query.category); }
  if (req.query.salaryMonth) { conditions.push('salary_month = ?'); params.push(req.query.salaryMonth); }
  if (req.query.flagged === '1' || req.query.flagged === 'true') { conditions.push('flagged = 1'); }
  if (req.query.search)    { conditions.push('title LIKE ?'); params.push(`%${req.query.search}%`); }

  let sortBy = req.query.sortBy || 'date';
  if (!SORTABLE.has(sortBy)) sortBy = 'date';
  const sortDir = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';
  const where = conditions.join(' AND ');

  const countRow = await db.get(`SELECT COUNT(*) AS c FROM sessions WHERE ${where}`, params);
  const total = Number(countRow.c);

  const rows = await db.all(
    `SELECT * FROM sessions WHERE ${where} ORDER BY ${sortBy} ${sortDir}, id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const sumRow = await db.get(
    `SELECT COALESCE(SUM(duration_hours),0) AS h, COALESCE(SUM(earnings),0) AS e FROM sessions WHERE ${where}`,
    params,
  );

  res.json({
    data: rows.map(mapSession),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    filterTotals: {
      totalHours: Math.round(Number(sumRow.h) * 100) / 100,
      totalEarnings: Math.round(Number(sumRow.e) * 100) / 100,
    },
  });
});

router.post('/', async (req, res) => {
  const db = await getDatabase();
  const userId = req.user.id;
  const clientId = req.body.clientId ? Number(req.body.clientId) : null;

  const client = await resolveClient(db, userId, clientId);
  let clientConfig = {};
  try { clientConfig = JSON.parse(client.config_json || '{}'); } catch (_) {}

  const raw = buildManualRawEvent(req.body || {}, clientConfig);
  await applyRawEventsToDatabase(db, [raw], userId, client.id, clientConfig);

  const row = await db.get(
    'SELECT * FROM sessions WHERE calendar_event_id = ? AND user_id = ?',
    [raw.calendarEventId, userId],
  );
  if (!row) {
    const err = new Error('Failed to create session');
    err.status = 500;
    throw err;
  }
  res.status(201).json(mapSession(row));
});

router.put('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!row) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  const body = req.body || {};
  const pairs = [];
  if (body.earnings !== undefined)    pairs.push(['earnings', Number(body.earnings)]);
  if (body.note !== undefined)        pairs.push(['note', String(body.note)]);
  if (body.flagged !== undefined)     pairs.push(['flagged', body.flagged ? 1 : 0]);
  if (body.category !== undefined)    pairs.push(['category', String(body.category)]);
  if (body.rateApplied !== undefined) pairs.push(['rate_applied', Number(body.rateApplied)]);

  if (!pairs.length) return res.json(mapSession(row));

  const setClauses = pairs.map(([col]) => `${col} = ?`);
  const vals = pairs.map(([, v]) => v);

  if (db.type === 'sqlite') {
    setClauses.push("updated_at = datetime('now')");
  } else {
    setClauses.push('updated_at = NOW()');
  }

  await db.run(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
    [...vals, id, req.user.id],
  );
  const next = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
  res.json(mapSession(next));
});

router.delete('/uncategorized', async (req, res) => {
  const db = await getDatabase();
  const userId = req.user.id;
  const clientId = req.query.clientId ? Number(req.query.clientId) : null;

  const conditions = ['user_id = ?', "category = 'Uncategorized'", 'flagged = 1'];
  const params = [userId];

  if (clientId) {
    conditions.push('client_id = ?');
    params.push(clientId);
  }

  const where = conditions.join(' AND ');
  const { changes } = await db.run(
    `DELETE FROM sessions WHERE ${where}`,
    params,
  );

  res.json({ deleted: changes });
});

router.delete('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const { changes } = await db.run(
    'DELETE FROM sessions WHERE id = ? AND user_id = ?',
    [id, req.user.id],
  );
  if (changes === 0) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  res.status(204).send();
});

module.exports = router;
