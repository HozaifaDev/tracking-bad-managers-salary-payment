/**
 * POST /api/calendar/sync — fetch Google Calendar and insert new sessions only.
 */
const fs = require('fs');
const express = require('express');
const { getDatabase } = require('../db/database');
const { readConfig } = require('../services/configService');
const { fetchCalendarEvents, tokenExists, credentialsPath } = require('../services/calendarService');
const { buildSessionRow } = require('../services/calculatorService');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    hasToken: tokenExists(),
    hasCredentials: fs.existsSync(credentialsPath()),
  });
});

router.post('/sync', async (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) {
    const err = new Error('from and to (YYYY-MM-DD) are required');
    err.status = 400;
    throw err;
  }

  const db = getDatabase();
  let fetched = 0;
  let newCount = 0;
  let skipped = 0;
  const flaggedTitles = new Set();

  try {
    const events = await fetchCalendarEvents(from, to);
    fetched = events.length;

    const existsStmt = db.prepare('SELECT id FROM sessions WHERE calendar_event_id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO sessions (
        calendar_event_id, title, date, day_of_week, start_time, end_time, duration_hours,
        category, sub_category, milestone, is_milestone_complete, rate_applied, earnings,
        salary_month, cycle_start, cycle_end, note, flagged
      ) VALUES (
        @calendar_event_id, @title, @date, @day_of_week, @start_time, @end_time, @duration_hours,
        @category, @sub_category, @milestone, @is_milestone_complete, @rate_applied, @earnings,
        @salary_month, @cycle_start, @cycle_end, @note, @flagged
      )
    `);

    const upsertDiploma = db.prepare(`
      INSERT INTO diploma_progress (track, milestone, completed, completion_date, payout_earned, session_id)
      VALUES (@track, @milestone, 1, @completion_date, @payout, @session_id)
      ON CONFLICT(track, milestone) DO UPDATE SET
        completed = excluded.completed,
        completion_date = excluded.completion_date,
        payout_earned = excluded.payout_earned,
        session_id = excluded.session_id
    `);

    const config = readConfig();

    // node:sqlite has no db.transaction() helper; use explicit BEGIN/COMMIT.
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const ev of events) {
        if (existsStmt.get(ev.calendarEventId)) {
          skipped += 1;
          continue;
        }
        const row = buildSessionRow(ev, config);
        const info = insertStmt.run(row);
        newCount += 1;
        if (row.flagged) flaggedTitles.add(row.title);

        if (row.category === 'Diploma' && row.is_milestone_complete && row.sub_category && row.milestone) {
          upsertDiploma.run({
            track: row.sub_category,
            milestone: row.milestone,
            completion_date: row.date,
            payout: row.earnings,
            session_id: Number(info.lastInsertRowid),
          });
        }
      }
      db.exec('COMMIT');
    } catch (txErr) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
      throw txErr;
    }

    db.prepare(
      `INSERT INTO sync_log (range_from, range_to, events_fetched, new_sessions, skipped, status)
       VALUES (?, ?, ?, ?, ?, 'success')`,
    ).run(from, to, fetched, newCount, skipped);

    res.json({
      fetched,
      new: newCount,
      skipped,
      flagged: flaggedTitles.size,
      flaggedTitles: [...flaggedTitles],
    });
  } catch (e) {
    db.prepare(
      `INSERT INTO sync_log (range_from, range_to, events_fetched, new_sessions, skipped, status, error_message)
       VALUES (?, ?, ?, ?, ?, 'error', ?)`,
    ).run(from, to, fetched, newCount, skipped, e.message);
    throw e;
  }
});

module.exports = router;
