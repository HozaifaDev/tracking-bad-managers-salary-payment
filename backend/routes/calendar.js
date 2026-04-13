/**
 * POST /api/calendar/sync — fetch Google Calendar and insert new sessions only.
 */
const fs = require('fs');
const express = require('express');
const { getDatabase } = require('../db/database');
const { fetchCalendarEvents, tokenExists, credentialsPath } = require('../services/calendarService');
const { applyRawEventsToDatabase } = require('../services/sessionSyncLogic');

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

    const result = applyRawEventsToDatabase(db, events);
    newCount = result.newCount;
    skipped = result.skipped;
    result.flaggedTitles.forEach((t) => flaggedTitles.add(t));

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
