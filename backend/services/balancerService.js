/**
 * Aggregates session earnings vs payments for dashboard and monthly breakdown.
 * Cumulative paid for a salary month = payments with date <= that cycle's end date.
 */
const { parse, format } = require('date-fns');
const { enUS } = require('date-fns/locale');
const { readConfig } = require('./configService');
const { getCycleRange } = require('./calculatorService');

function getAllTimeSummary(db) {
  const totalEarnedRow = db.prepare('SELECT COALESCE(SUM(earnings), 0) AS s FROM sessions').get();
  const totalPaidRow = db.prepare('SELECT COALESCE(SUM(amount_egp), 0) AS s FROM payments').get();
  const totalSessions = Number(db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c);
  const totalHoursRow = db.prepare('SELECT COALESCE(SUM(duration_hours), 0) AS s FROM sessions').get();
  const flaggedSessions = Number(db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE flagged = 1').get().c);
  const lastSyncRow = db
    .prepare(
      `SELECT synced_at FROM sync_log WHERE status = 'success' ORDER BY id DESC LIMIT 1`,
    )
    .get();

  const totalEarned = Math.round(Number(totalEarnedRow.s) * 100) / 100;
  const totalPaid = Math.round(Number(totalPaidRow.s) * 100) / 100;
  return {
    totalEarned,
    totalPaid,
    balance: Math.round((totalEarned - totalPaid) * 100) / 100,
    totalSessions,
    totalHours: Math.round(Number(totalHoursRow.s) * 100) / 100,
    flaggedSessions,
    lastSync: lastSyncRow ? lastSyncRow.synced_at : null,
  };
}

function monthSortKey(label, startDay) {
  const { end } = getCycleRange(label, startDay);
  const d = parse(end, 'yyyy-MM-dd', new Date());
  return d.getTime();
}

/**
 * Monthly rows with running earned/paid/balance (same semantics as Python Excel).
 */
function getMonthlyBreakdown(db) {
  const config = readConfig();
  const startDay = Number(config.work_cycle_start_day) || 25;

  const months = db
    .prepare(
      `SELECT salary_month AS sm FROM sessions WHERE salary_month IS NOT NULL GROUP BY salary_month`,
    )
    .all()
    .map((r) => r.sm);

  const unique = [...new Set(months)].sort(
    (a, b) => monthSortKey(a, startDay) - monthSortKey(b, startDay),
  );

  const payments = db
    .prepare(`SELECT date, amount_egp FROM payments ORDER BY date ASC`)
    .all();

  const rows = [];
  let cumEarned = 0;

  for (const salaryMonth of unique) {
    const agg = db
      .prepare(
        `SELECT COUNT(*) AS c, COALESCE(SUM(duration_hours),0) AS h, COALESCE(SUM(earnings),0) AS e
         FROM sessions WHERE salary_month = ?`,
      )
      .get(salaryMonth);

    const expected = Math.round(Number(agg.e) * 100) / 100;
    const hours = Math.round(Number(agg.h) * 100) / 100;
    cumEarned = Math.round((cumEarned + expected) * 100) / 100;

    const { start, end } = getCycleRange(salaryMonth, startDay);
    const cycleEnd = parse(end, 'yyyy-MM-dd', new Date());
    let cumPaid = 0;
    for (const p of payments) {
      const pd = parse(p.date, 'yyyy-MM-dd', new Date());
      if (pd <= cycleEnd) cumPaid += Number(p.amount_egp);
    }
    cumPaid = Math.round(cumPaid * 100) / 100;
    const runningBalance = Math.round((cumEarned - cumPaid) * 100) / 100;

    const startD = parse(start, 'yyyy-MM-dd', new Date());
    const cycleLabel = `${format(startD, 'MMM d', { locale: enUS })} – ${format(cycleEnd, 'MMM d, yyyy', { locale: enUS })}`;

    rows.push({
      salaryMonth,
      cyclePeriod: cycleLabel,
      cycleStart: start,
      cycleEnd: end,
      sessionsCount: agg.c,
      totalHours: hours,
      expectedEarnings: expected,
      cumulativeEarned: cumEarned,
      cumulativePaid: cumPaid,
      runningBalance,
    });
  }

  return rows;
}

module.exports = { getAllTimeSummary, getMonthlyBreakdown };
