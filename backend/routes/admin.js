/**
 * Admin utilities for local app usage only.
 * POST /api/admin/reset — wipe stored data tables.
 */
const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

/**
 * Body:
 * - confirm: must equal "RESET"
 * - scope: "all" (default) | "sessions"
 */
router.post('/reset', (req, res) => {
  const body = req.body || {};
  const confirm = String(body.confirm || '').trim();
  const scope = String(body.scope || 'all').trim();

  if (confirm !== 'RESET') {
    const err = new Error('Confirmation required. Send { "confirm": "RESET" }.');
    err.status = 400;
    throw err;
  }

  if (!['all', 'sessions'].includes(scope)) {
    const err = new Error('scope must be "all" or "sessions"');
    err.status = 400;
    throw err;
  }

  const db = getDatabase();

  db.exec('BEGIN IMMEDIATE');
  try {
    // Always wipe session-derived tables first (FK-safe ordering).
    db.exec('DELETE FROM diploma_progress;');
    db.exec('DELETE FROM sessions;');
    db.exec('DELETE FROM sync_log;');

    if (scope === 'all') {
      db.exec('DELETE FROM payments;');
    }

    db.exec('COMMIT');
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  }

  res.json({ ok: true, scope });
});

module.exports = router;
