const express = require('express');
const multer = require('multer');
const { getDatabase } = require('../db/database');
const { parseIcsToEvents, extractUniqueTitles, detectTitleGroups } = require('../services/icsImportService');
const { applyRawEventsToDatabase } = require('../services/sessionSyncLogic');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function resolveClient(reqClientId, userId) {
  return async (db) => {
    if (reqClientId) {
      return db.get('SELECT * FROM clients WHERE id = ? AND user_id = ?', [reqClientId, userId]);
    }
    return db.get('SELECT * FROM clients WHERE user_id = ? AND is_default = 1', [userId]);
  };
}

function parseClientConfig(client) {
  try { return JSON.parse(client.config_json || '{}'); } catch (_) { return {}; }
}

function extractIcsText(req) {
  if (req.file?.buffer) return req.file.buffer.toString('utf8');
  if (typeof req.body?.ics === 'string') return req.body.ics;
  return '';
}

function sanitizeRange(from, to) {
  return {
    from: from && String(from).trim() || null,
    to: to && String(to).trim() || null,
  };
}

// ─── POST /ics — existing direct import (kept for backward compat) ──────────────

router.post(
  '/ics',
  (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) return upload.single('file')(req, res, next);
    next();
  },
  async (req, res) => {
    const { from: rawFrom, to: rawTo } = sanitizeRange(req.query.from || req.body?.from, req.query.to || req.body?.to);
    const reqClientId = req.query.clientId || req.body?.clientId;

    const icsText = extractIcsText(req);

    if (!icsText.trim()) {
      const err = new Error('Provide a .ics file (multipart field "file") or JSON { "ics": "BEGIN:VCALENDAR..." }');
      err.status = 400;
      throw err;
    }

    const db = await getDatabase();
    const userId = req.user.id;

    const client = await resolveClient(reqClientId, userId)(db);
    if (!client) {
      const err = new Error('No client found. Create a client first.');
      err.status = 400;
      throw err;
    }
    const clientConfig = parseClientConfig(client);

    const tz = clientConfig.timezone || 'Africa/Cairo';
    const range = {};
    if (rawFrom) range.from = rawFrom;
    if (rawTo)   range.to   = rawTo;

    const rawEvents = parseIcsToEvents(icsText, tz, range);
    const fetched = rawEvents.length;

    const { newCount, skipped, flaggedTitles } = await applyRawEventsToDatabase(
      db, rawEvents, userId, client.id, clientConfig,
    );

    await db.run(
      `INSERT INTO sync_log (user_id, range_from, range_to, events_fetched, new_sessions, skipped, status)
       VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [userId, `ics:${rawFrom || '…'}→${rawTo || '…'}`, 'ics-import', fetched, newCount, skipped],
    );

    res.json({ fetched, new: newCount, skipped, flagged: flaggedTitles.size, flaggedTitles: [...flaggedTitles], source: 'ics' });
  },
);

// ─── POST /ics/preview — parse ICS and return title analysis without importing ──

router.post(
  '/ics/preview',
  (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) return upload.single('file')(req, res, next);
    next();
  },
  async (req, res) => {
    const { from: rawFrom, to: rawTo } = sanitizeRange(req.query.from || req.body?.from, req.query.to || req.body?.to);
    const reqClientId = req.query.clientId || req.body?.clientId;
    const delimiter = req.query.delimiter || req.body?.delimiter || ' - ';

    const icsText = extractIcsText(req);

    if (!icsText.trim()) {
      const err = new Error('Provide a .ics file or JSON { "ics": "..." }');
      err.status = 400;
      throw err;
    }

    const db = await getDatabase();
    const userId = req.user.id;

    const client = await resolveClient(reqClientId, userId)(db);
    if (!client) {
      const err = new Error('No client found. Create a client first.');
      err.status = 400;
      throw err;
    }
    const clientConfig = parseClientConfig(client);

    const tz = clientConfig.timezone || 'Africa/Cairo';
    const range = {};
    if (rawFrom) range.from = rawFrom;
    if (rawTo)   range.to   = rawTo;

    const rawEvents = parseIcsToEvents(icsText, tz, range);
    if (!rawEvents.length) {
      return res.json({
        totalEvents: 0,
        dateRange: { from: null, to: null },
        uniqueTitles: [],
        suggestedGroups: [],
        existingWorkTypes: clientConfig.work_types || [],
        clientId: client.id,
        clientName: client.name,
        currency: client.currency,
      });
    }

    const { uniqueTitles, totalEvents, dateRange } = extractUniqueTitles(rawEvents);
    const suggestedGroups = detectTitleGroups(uniqueTitles, delimiter);

    res.json({
      totalEvents,
      dateRange,
      uniqueTitles,
      suggestedGroups,
      existingWorkTypes: clientConfig.work_types || [],
      clientId: client.id,
      clientName: client.name,
      currency: client.currency,
    });
  },
);

// ─── POST /ics/confirm — import with user-provided mappings ─────────────────────

router.post(
  '/ics/confirm',
  async (req, res) => {
    const body = req.body || {};
    const ics = body.ics;
    const clientId = body.clientId || null;
    const { from: rawFrom, to: rawTo } = sanitizeRange(body.from, body.to);
    const delimiter = body.delimiter || ' - ';
    const mappings = body.mappings;
    const skippedTitles = body.skippedTitles;

    if (!ics || typeof ics !== 'string' || !ics.trim()) {
      const err = new Error('ics (raw ICS text) is required');
      err.status = 400;
      throw err;
    }
    if (!Array.isArray(mappings)) {
      const err = new Error('mappings must be an array');
      err.status = 400;
      throw err;
    }

    const db = await getDatabase();
    const userId = req.user.id;

    const client = await resolveClient(clientId, userId)(db);
    if (!client) {
      const err = new Error('No client found. Create a client first.');
      err.status = 400;
      throw err;
    }
    const clientConfig = parseClientConfig(client);

    const tz = clientConfig.timezone || 'Africa/Cairo';
    const range = {};
    if (rawFrom) range.from = rawFrom;
    if (rawTo)   range.to   = rawTo;

    const rawEvents = parseIcsToEvents(ics, tz, range);
    if (!rawEvents.length) {
      return res.json({ fetched: 0, new: 0, skipped: 0, flagged: 0, flaggedTitles: [], skippedByUser: 0, mappingBreakdown: {}, source: 'ics' });
    }

    const normalizedMappings = mappings.map((m) => ({
      keyword: String(m.keyword || '').trim(),
      workTypeName: String(m.workTypeName || '').trim(),
      rateType: String(m.rateType || 'hourly'),
      rate: Number(m.rate) || 0,
      color: String(m.color || '#6366f1'),
      delimiter: String(m.delimiter || delimiter || ' - '),
    })).filter((m) => m.keyword && m.workTypeName);

    const normalizedSkipped = Array.isArray(skippedTitles) ? skippedTitles.map((t) => String(t).trim()) : [];

    const result = await applyRawEventsToDatabase(
      db, rawEvents, userId, client.id, clientConfig,
      { mappings: normalizedMappings, skippedTitles: normalizedSkipped },
    );

    // Auto-save new work types to client config
    if (normalizedMappings.length > 0) {
      const workTypes = clientConfig.work_types || [];
      const existingNames = new Set(workTypes.map((wt) => wt.name.toLowerCase()));
      let changed = false;

      for (const m of normalizedMappings) {
        if (!existingNames.has(m.workTypeName.toLowerCase())) {
          workTypes.push({
            name: m.workTypeName,
            rate_type: m.rateType,
            rate: m.rate,
            color: m.color || '#6366f1',
          });
          existingNames.add(m.workTypeName.toLowerCase());
          changed = true;
        }
      }

      if (changed) {
        clientConfig.work_types = workTypes;
        await db.run(
          'UPDATE clients SET config_json = ? WHERE id = ? AND user_id = ?',
          [JSON.stringify(clientConfig), client.id, userId],
        );
      }
    }

    await db.run(
      `INSERT INTO sync_log (user_id, range_from, range_to, events_fetched, new_sessions, skipped, status)
       VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [userId, `ics:${rawFrom || '…'}→${rawTo || '…'}`, 'ics-import-mapped', rawEvents.length, result.newCount, result.skipped],
    );

    res.json({
      fetched: rawEvents.length,
      new: result.newCount,
      skipped: result.skipped,
      skippedByUser: result.skippedByUser || 0,
      flagged: result.flaggedTitles.size,
      flaggedTitles: [...result.flaggedTitles],
      mappingBreakdown: result.mappingBreakdown,
      source: 'ics',
    });
  },
);

module.exports = router;