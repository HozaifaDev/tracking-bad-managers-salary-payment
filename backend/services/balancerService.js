const { parse, format } = require('date-fns');
const { enUS } = require('date-fns/locale');
const { readConfig } = require('./configService');
const { getCycleRange } = require('./calculatorService');

async function getAllTimeSummary(db, userId) {
  const [earnedRow, paidRow, countRow, hoursRow, flaggedRow, lastSyncRow] = await Promise.all([
    db.get('SELECT COALESCE(SUM(earnings), 0) AS s FROM sessions WHERE user_id = ?', [userId]),
    db.get('SELECT COALESCE(SUM(amount_egp), 0) AS s FROM payments WHERE user_id = ?', [userId]),
    db.get('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?', [userId]),
    db.get('SELECT COALESCE(SUM(duration_hours), 0) AS s FROM sessions WHERE user_id = ?', [userId]),
    db.get('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND flagged = 1', [userId]),
    db.get(
      `SELECT synced_at FROM sync_log WHERE user_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1`,
      [userId],
    ),
  ]);

  const totalEarned = Math.round(Number(earnedRow.s) * 100) / 100;
  const totalPaid = Math.round(Number(paidRow.s) * 100) / 100;
  return {
    totalEarned,
    totalPaid,
    balance: Math.round((totalEarned - totalPaid) * 100) / 100,
    totalSessions: Number(countRow.c),
    totalHours: Math.round(Number(hoursRow.s) * 100) / 100,
    flaggedSessions: Number(flaggedRow.c),
    lastSync: lastSyncRow ? lastSyncRow.synced_at : null,
  };
}

function monthSortKey(label, startDay) {
  const { end } = getCycleRange(label, startDay);
  return parse(end, 'yyyy-MM-dd', new Date()).getTime();
}

async function getMonthlyBreakdown(db, userId) {
  const config = readConfig();
  const startDay = Number(config.work_cycle_start_day) || 25;

  const monthRows = await db.all(
    `SELECT salary_month AS sm FROM sessions WHERE user_id = ? AND salary_month IS NOT NULL GROUP BY salary_month`,
    [userId],
  );

  const unique = [...new Set(monthRows.map((r) => r.sm))].sort(
    (a, b) => monthSortKey(a, startDay) - monthSortKey(b, startDay),
  );

  const payments = await db.all(
    'SELECT date, amount_egp FROM payments WHERE user_id = ? ORDER BY date ASC',
    [userId],
  );

  const rows = [];
  let cumEarned = 0;

  for (const salaryMonth of unique) {
    const agg = await db.get(
      `SELECT COUNT(*) AS c, COALESCE(SUM(duration_hours),0) AS h, COALESCE(SUM(earnings),0) AS e
       FROM sessions WHERE user_id = ? AND salary_month = ?`,
      [userId, salaryMonth],
    );

    const expected = Math.round(Number(agg.e) * 100) / 100;
    const hours = Math.round(Number(agg.h) * 100) / 100;
    cumEarned = Math.round((cumEarned + expected) * 100) / 100;

    const { start, end } = getCycleRange(salaryMonth, startDay);
    const cycleEnd = parse(end, 'yyyy-MM-dd', new Date());
    let cumPaid = 0;
    for (const p of payments) {
      if (parse(p.date, 'yyyy-MM-dd', new Date()) <= cycleEnd) cumPaid += Number(p.amount_egp);
    }
    cumPaid = Math.round(cumPaid * 100) / 100;

    const startD = parse(start, 'yyyy-MM-dd', new Date());
    rows.push({
      salaryMonth,
      cyclePeriod: `${format(startD, 'MMM d', { locale: enUS })} – ${format(cycleEnd, 'MMM d, yyyy', { locale: enUS })}`,
      cycleStart: start,
      cycleEnd: end,
      sessionsCount: agg.c,
      totalHours: hours,
      expectedEarnings: expected,
      cumulativeEarned: cumEarned,
      cumulativePaid: cumPaid,
      runningBalance: Math.round((cumEarned - cumPaid) * 100) / 100,
    });
  }

  return rows;
}

module.exports = { getAllTimeSummary, getMonthlyBreakdown };
