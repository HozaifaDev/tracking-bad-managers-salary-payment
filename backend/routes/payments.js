/**
 * Payment CRUD; list sorted by date descending.
 */
const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

function mapPayment(r) {
  return {
    id: r.id,
    date: r.date,
    amountEgp: r.amount_egp,
    note: r.note,
    createdAt: r.created_at,
  };
}

router.get('/', (req, res) => {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM payments ORDER BY date DESC, id DESC').all();
  res.json(rows.map(mapPayment));
});

router.post('/', (req, res) => {
  const { date, amount_egp, amountEgp, note } = req.body || {};
  const amt = amount_egp ?? amountEgp;
  if (!date || amt == null) {
    const err = new Error('date and amount_egp (or amountEgp) are required');
    err.status = 400;
    throw err;
  }
  const db = getDatabase();
  const info = db
    .prepare('INSERT INTO payments (date, amount_egp, note) VALUES (?, ?, ?)')
    .run(date, Number(amt), note || '');
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(mapPayment(row));
});

router.put('/:id', (req, res) => {
  const db = getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  const b = req.body || {};
  const date = b.date !== undefined ? b.date : row.date;
  const amt =
    b.amount_egp !== undefined
      ? Number(b.amount_egp)
      : b.amountEgp !== undefined
        ? Number(b.amountEgp)
        : row.amount_egp;
  const note = b.note !== undefined ? b.note : row.note;
  db.prepare('UPDATE payments SET date = ?, amount_egp = ?, note = ? WHERE id = ?').run(date, amt, note, id);
  const next = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.json(mapPayment(next));
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  if (Number(info.changes) === 0) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  res.status(204).send();
});

module.exports = router;
