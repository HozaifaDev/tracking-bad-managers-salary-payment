const express = require('express');
const { getDatabase } = require('../db/database');
const { getMonthlyBreakdown } = require('../services/balancerService');
const { differenceInDays, parse } = require('date-fns');

const router = express.Router();

router.get('/overdue', async (req, res) => {
  const db = await getDatabase();
  const clientId = req.query.clientId ? parseInt(req.query.clientId, 10) : null;

  const settings = await db.get(
    'SELECT threshold_days FROM alert_settings WHERE user_id = ?',
    [req.user.id],
  );
  const thresholdDays = settings?.threshold_days || 7;

  const breakdown = await getMonthlyBreakdown(db, req.user.id, clientId);
  const today = new Date();

  const overdueCycles = breakdown
    .filter((m) => {
      if (m.runningBalance <= 0) return false;
      const cycleEnd = parse(m.cycleEnd, 'yyyy-MM-dd', new Date());
      const daysOverdue = differenceInDays(today, cycleEnd);
      return daysOverdue >= thresholdDays;
    })
    .map((m) => {
      const cycleEnd = parse(m.cycleEnd, 'yyyy-MM-dd', new Date());
      const daysOverdue = differenceInDays(today, cycleEnd);
      return {
        salaryMonth: m.salaryMonth,
        salaryLabel: m.salaryLabel,
        cyclePeriod: m.cyclePeriod,
        expectedEarnings: m.expectedEarnings,
        runningBalance: m.runningBalance,
        daysOverdue,
      };
    });

  const totalOwed = overdueCycles.length > 0
    ? overdueCycles[overdueCycles.length - 1].runningBalance
    : 0;

  res.json({
    hasOverdue: overdueCycles.length > 0,
    overdueCount: overdueCycles.length,
    totalOwed,
    thresholdDays,
    cycles: overdueCycles,
  });
});

module.exports = router;