/**
 * Summary, monthly breakdown, Excel export stream.
 */
const express = require('express');
const { getDatabase } = require('../db/database');
const { getAllTimeSummary, getMonthlyBreakdown } = require('../services/balancerService');
const { buildWorkbook } = require('../services/reportService');

const router = express.Router();

router.get('/summary', (req, res) => {
  const db = getDatabase();
  res.json(getAllTimeSummary(db));
});

router.get('/monthly', (req, res) => {
  const db = getDatabase();
  res.json(getMonthlyBreakdown(db));
});

router.get('/export', async (req, res) => {
  const { from, to } = req.query;
  const wb = await buildWorkbook({ from, to });
  const buf = await wb.xlsx.writeBuffer();
  const name = `salary_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(Buffer.from(buf));
});

module.exports = router;
