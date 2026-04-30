const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

function mapPayment(r) {
  return { id: r.id, date: r.date, amountEgp: r.amount_egp, note: r.note, createdAt: r.created_at };
}

router.get('/', async (req, res) => {
  const db = await getDatabase();
  const rows = await db.all(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY date DESC, id DESC',
    [req.user.id],
  );
  res.json(rows.map(mapPayment));
});

router.post('/', async (req, res) => {
  const { date, amount_egp, amountEgp, note } = req.body || {};
  const amt = amount_egp ?? amountEgp;
  if (!date || amt == null) {
    const err = new Error('date and amount_egp (or amountEgp) are required');
    err.status = 400;
    throw err;
  }
  const db = await getDatabase();
  const { lastId } = await db.run(
    'INSERT INTO payments (user_id, date, amount_egp, note) VALUES (?, ?, ?, ?)',
    [req.user.id, date, Number(amt), note || ''],
  );
  const row = await db.get('SELECT * FROM payments WHERE id = ?', [lastId]);
  res.status(201).json(mapPayment(row));
});

router.put('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const row = await db.get('SELECT * FROM payments WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!row) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  const b = req.body || {};
  const date = b.date !== undefined ? b.date : row.date;
  const amt = b.amount_egp !== undefined
    ? Number(b.amount_egp)
    : b.amountEgp !== undefined
      ? Number(b.amountEgp)
      : row.amount_egp;
  const note = b.note !== undefined ? b.note : row.note;
  await db.run(
    'UPDATE payments SET date = ?, amount_egp = ?, note = ? WHERE id = ? AND user_id = ?',
    [date, amt, note, id, req.user.id],
  );
  const next = await db.get('SELECT * FROM payments WHERE id = ?', [id]);
  res.json(mapPayment(next));
});

router.delete('/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id, 10);
  const { changes } = await db.run(
    'DELETE FROM payments WHERE id = ? AND user_id = ?',
    [id, req.user.id],
  );
  if (changes === 0) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  res.status(204).send();
});

module.exports = router;
