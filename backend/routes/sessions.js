/**
 * Session CRUD + filtered pagination (50 per page) and server-side sort.
 */
const express = require('express');
const { getDatabase } = require('../db/database');
const { readConfig } = require('../services/configService');
const { buildManualRawEvent } = require('../services/calculatorService');
const { applyRawEventsToDatabase } = require('../services/sessionSyncLogic');

const router = express.Router();

const SORTABLE = new Set([
  'date',
  'title',
  'category',
  'duration_hours',
  'rate_applied',
  'earnings',
  'salary_month',
  'flagged',
  'id',
]);

function mapSession(r) {
  if (!r) return null;
  return {
    id: r.id,
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

router.get('/', (req, res) => {
  const db = getDatabase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];

  if (req.query.from) {
    conditions.push('date >= ?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    conditions.push('date <= ?');
    params.push(req.query.to);
  }
  if (req.query.category) {
    conditions.push('category = ?');
    params.push(req.query.category);
  }
  if (req.query.salaryMonth) {
    conditions.push('salary_month = ?');
    params.push(req.query.salaryMonth);
  }
  if (req.query.flagged === '1' || req.query.flagged === 'true') {
    conditions.push('flagged = 1');
  }
  if (req.query.search) {
    conditions.push('title LIKE ?');
    params.push(`%${req.query.search}%`);
  }

  let sortBy = req.query.sortBy || 'date';
  if (!SORTABLE.has(sortBy)) sortBy = 'date';
  const sortDir = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

  const whereSql = conditions.join(' AND ');
  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE ${whereSql}`).get(...params);
  const total = Number(countRow.c);

  const rows = db
    .prepare(
      `SELECT * FROM sessions WHERE ${whereSql} ORDER BY ${sortBy} ${sortDir}, id ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  const sumRow = db
    .prepare(
      `SELECT COALESCE(SUM(duration_hours),0) AS h, COALESCE(SUM(earnings),0) AS e FROM sessions WHERE ${whereSql}`,
    )
    .get(...params);

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

/** Manual session (no Google Calendar API). Body: { date, title, durationHours } */
router.post('/', (req, res) => {
  const config = readConfig();
  const raw = buildManualRawEvent(req.body || {}, config);
  const db = getDatabase();
  applyRawEventsToDatabase(db, [raw]);
  const row = db.prepare('SELECT * FROM sessions WHERE calendar_event_id = ?').get(raw.calendarEventId);
  if (!row) {
    const err = new Error('Failed to create session');
    err.status = 500;
    throw err;
  }
  res.status(201).json(mapSession(row));
});

router.put('/:id', (req, res) => {
  const db = getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  const body = req.body || {};
  const pairs = [];
  if (body.earnings !== undefined) pairs.push(['earnings', Number(body.earnings)]);
  if (body.note !== undefined) pairs.push(['note', String(body.note)]);
  if (body.flagged !== undefined) pairs.push(['flagged', body.flagged ? 1 : 0]);
  if (body.category !== undefined) pairs.push(['category', String(body.category)]);
  if (body.rateApplied !== undefined) pairs.push(['rate_applied', Number(body.rateApplied)]);

  const updates = [];
  const vals = [];
  for (const [col, v] of pairs) {
    updates.push(`${col} = ?`);
    vals.push(v);
  }
  if (!updates.length) {
    return res.json(mapSession(row));
  }
  updates.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  const next = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  res.json(mapSession(next));
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  if (Number(info.changes) === 0) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  res.status(204).send();
});

module.exports = router;
