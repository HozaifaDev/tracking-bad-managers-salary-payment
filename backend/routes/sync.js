const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

router.get('/log', async (req, res) => {
  const db = await getDatabase();
  const rows = await db.all(
    `SELECT id, synced_at AS syncedAt, range_from AS rangeFrom, range_to AS rangeTo,
            events_fetched AS eventsFetched, new_sessions AS newSessions, skipped,
            status, error_message AS errorMessage
     FROM sync_log WHERE user_id = ? ORDER BY id DESC LIMIT 10`,
    [req.user.id],
  );
  res.json(rows);
});

module.exports = router;
