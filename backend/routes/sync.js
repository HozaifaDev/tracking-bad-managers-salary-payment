/**
 * GET /api/sync/log — recent sync history for the UI.
 */
const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

router.get('/log', (req, res) => {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, synced_at AS syncedAt, range_from AS rangeFrom, range_to AS rangeTo,
              events_fetched AS eventsFetched, new_sessions AS newSessions, skipped,
              status, error_message AS errorMessage
       FROM sync_log ORDER BY id DESC LIMIT 10`,
    )
    .all();
  res.json(rows);
});

module.exports = router;
