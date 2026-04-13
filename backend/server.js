/**
 * Express API for Hours & Salary Tracker (local full-stack app).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
require('express-async-errors');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { getDatabase } = require('./db/database');

const sessionsRouter = require('./routes/sessions');
const paymentsRouter = require('./routes/payments');
const calendarRouter = require('./routes/calendar');
const syncRouter = require('./routes/sync');
const reportsRouter = require('./routes/reports');
const configRouter = require('./routes/config');
const importRouter = require('./routes/import');
const adminRouter = require('./routes/admin');

// Touch DB early so migrations run before first request
getDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/sessions', sessionsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/sync', syncRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/config', configRouter);
app.use('/api/import', importRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Hours Tracker API listening on http://localhost:${PORT}`);
});
