const express = require('express');
const multer = require('multer');
const { getDatabase } = require('../db/database');
const { readConfig } = require('../services/configService');
const { parseIcsToEvents } = require('../services/icsImportService');
const { applyRawEventsToDatabase } = require('../services/sessionSyncLogic');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.post(
  '/ics',
  (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) return upload.single('file')(req, res, next);
    next();
  },
  async (req, res) => {
    const from = req.query.from || req.body?.from;
    const to = req.query.to || req.body?.to;

    let icsText = '';
    if (req.file?.buffer) {
      icsText = req.file.buffer.toString('utf8');
    } else if (typeof req.body?.ics === 'string') {
      icsText = req.body.ics;
    }

    if (!icsText.trim()) {
      const err = new Error('Provide a .ics file (multipart field "file") or JSON { "ics": "BEGIN:VCALENDAR..." }');
      err.status = 400;
      throw err;
    }

    const config = readConfig();
    const tz = config.timezone || 'Africa/Cairo';
    const range = {};
    if (from) range.from = from;
    if (to) range.to = to;

    const rawEvents = parseIcsToEvents(icsText, tz, range);
    const fetched = rawEvents.length;
    const db = await getDatabase();
    const userId = req.user.id;

    const { newCount, skipped, flaggedTitles } = await applyRawEventsToDatabase(db, rawEvents, userId);

    await db.run(
      `INSERT INTO sync_log (user_id, range_from, range_to, events_fetched, new_sessions, skipped, status)
       VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [userId, `ics:${from || '…'}→${to || '…'}`, 'ics-import', fetched, newCount, skipped],
    );

    res.json({ fetched, new: newCount, skipped, flagged: flaggedTitles.size, flaggedTitles: [...flaggedTitles], source: 'ics' });
  },
);

module.exports = router;
