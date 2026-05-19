const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

function mapClient(r) {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    currency: r.currency,
    workCycleStartDay: r.work_cycle_start_day,
    paymentDueStartDay: r.payment_due_start_day ?? 1,
    paymentDueEndDay: r.payment_due_end_day ?? 5,
    config: tryParseJson(r.config_json),
    isDefault: Boolean(r.is_default),
    createdAt: r.created_at,
  };
}

function tryParseJson(str) {
  try { return JSON.parse(str || '{}'); } catch (_) { return {}; }
}

// GET / — list all clients for the authenticated user
router.get('/', async (req, res) => {
  const db = await getDatabase();
  const rows = await db.all(
    'SELECT * FROM clients WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
    [req.user.id],
  );
  res.json(rows.map(mapClient));
});

// POST / — create a new client
router.post('/', async (req, res) => {
  const { name, currency, workCycleStartDay, config } = req.body || {};
  if (!name || !String(name).trim()) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }
  const db = await getDatabase();

  // Plan gate: free users are limited to 1 client
  const userRow = await db.get('SELECT plan FROM users WHERE id = ?', [req.user.id]);
  if ((userRow?.plan || 'free') === 'free') {
    const { c } = await db.get('SELECT COUNT(*) AS c FROM clients WHERE user_id = ?', [req.user.id]);
    if (Number(c) >= 1) {
      return res.status(403).json({
        error: 'Free plan is limited to 1 client. Upgrade to Pro for unlimited clients.',
        code: 'upgrade_required',
      });
    }
  }
  const configJson = JSON.stringify(config || { work_types: [], timezone: 'UTC' });
  const { lastId } = await db.run(
    `INSERT INTO clients (user_id, name, currency, work_cycle_start_day, config_json, is_default)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [
      req.user.id,
      String(name).trim(),
      String(currency || 'EGP').trim(),
      Number(workCycleStartDay) || 25,
      configJson,
    ],
  );
  const row = await db.get('SELECT * FROM clients WHERE id = ?', [lastId]);
  res.status(201).json(mapClient(row));
});

// GET /:id — get a single client
router.get('/:id', async (req, res) => {
  const db = await getDatabase();
  const row = await db.get(
    'SELECT * FROM clients WHERE id = ? AND user_id = ?',
    [parseInt(req.params.id, 10), req.user.id],
  );
  if (!row) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }
  res.json(mapClient(row));
});

// PUT /:id — update a client
router.put('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = await db.get(
    'SELECT * FROM clients WHERE id = ? AND user_id = ?',
    [id, req.user.id],
  );
  if (!row) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }

  const name = b.name !== undefined ? String(b.name).trim() : row.name;
  const currency = b.currency !== undefined ? String(b.currency).trim() : row.currency;
  const startDay = b.workCycleStartDay !== undefined ? Number(b.workCycleStartDay) : row.work_cycle_start_day;
  const dueStartDay = b.paymentDueStartDay !== undefined ? Number(b.paymentDueStartDay) : (row.payment_due_start_day ?? 1);
  const dueEndDay = b.paymentDueEndDay !== undefined ? Number(b.paymentDueEndDay) : (row.payment_due_end_day ?? 5);
  const configJson = b.config !== undefined ? JSON.stringify(b.config) : row.config_json;

  await db.run(
    'UPDATE clients SET name = ?, currency = ?, work_cycle_start_day = ?, payment_due_start_day = ?, payment_due_end_day = ?, config_json = ? WHERE id = ? AND user_id = ?',
    [name, currency, startDay, dueStartDay, dueEndDay, configJson, id, req.user.id],
  );
  const next = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
  res.json(mapClient(next));
});

// DELETE /:id — delete a client (only if it has no sessions or payments)
router.delete('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = await db.get(
    'SELECT * FROM clients WHERE id = ? AND user_id = ?',
    [id, req.user.id],
  );
  if (!row) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }
  if (row.is_default) {
    const err = new Error('Cannot delete the default client');
    err.status = 400;
    throw err;
  }
  const sessCount = await db.get('SELECT COUNT(*) AS c FROM sessions WHERE client_id = ?', [id]);
  const payCount = await db.get('SELECT COUNT(*) AS c FROM payments WHERE client_id = ?', [id]);
  if (Number(sessCount.c) > 0 || Number(payCount.c) > 0) {
    const err = new Error('Cannot delete a client that has sessions or payments. Move or delete them first.');
    err.status = 400;
    throw err;
  }
  await db.run('DELETE FROM clients WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.status(204).send();
});

// POST /:id/default — set as the user's default client
router.post('/:id/default', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = await db.get(
    'SELECT * FROM clients WHERE id = ? AND user_id = ?',
    [id, req.user.id],
  );
  if (!row) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }
  // Unset current default, set new default
  await db.run('UPDATE clients SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  await db.run('UPDATE clients SET is_default = 1 WHERE id = ?', [id]);
  res.json({ ok: true });
});

module.exports = router;
