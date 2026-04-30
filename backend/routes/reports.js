const express = require('express');
const { getDatabase } = require('../db/database');
const { getAllTimeSummary, getMonthlyBreakdown } = require('../services/balancerService');
const { buildWorkbook } = require('../services/reportService');

const router = express.Router();

router.get('/summary', async (req, res) => {
  const db = await getDatabase();
  res.json(await getAllTimeSummary(db, req.user.id));
});

router.get('/monthly', async (req, res) => {
  const db = await getDatabase();
  res.json(await getMonthlyBreakdown(db, req.user.id));
});

router.get('/export', async (req, res) => {
  const { from, to } = req.query;
  const wb = await buildWorkbook({ from, to, userId: req.user.id });
  const buf = await wb.xlsx.writeBuffer();
  const name = `salary_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(Buffer.from(buf));
});

module.exports = router;
