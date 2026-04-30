const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

router.post('/reset', async (req, res) => {
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

  const db = await getDatabase();
  const userId = req.user.id;

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM diploma_progress WHERE user_id = ?', [userId]);
    await tx.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
    await tx.run('DELETE FROM sync_log WHERE user_id = ?', [userId]);
    if (scope === 'all') {
      await tx.run('DELETE FROM payments WHERE user_id = ?', [userId]);
    }
  });

  res.json({ ok: true, scope });
});

module.exports = router;
