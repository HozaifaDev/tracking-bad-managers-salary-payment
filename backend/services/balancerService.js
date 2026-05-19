const { parse, format } = require('date-fns');
const { enUS } = require('date-fns/locale');
const { getCycleRange, getPaymentDueWindow } = require('./calculatorService');

async function getAllTimeSummary(db, userId, clientId) {
  const clientFilter = clientId ? ' AND client_id = ?' : '';
  const sessParams = clientId ? [userId, clientId] : [userId];
  const payParams  = clientId ? [userId, clientId] : [userId];

  const [earnedRow, paidRow, countRow, hoursRow, flaggedRow, lastSyncRow] = await Promise.all([
    db.get(`SELECT COALESCE(SUM(earnings), 0) AS s FROM sessions WHERE user_id = ?${clientFilter}`, sessParams),
    db.get(`SELECT COALESCE(SUM(amount_egp), 0) AS s FROM payments WHERE user_id = ?${clientFilter}`, payParams),
    db.get(`SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?${clientFilter}`, sessParams),
    db.get(`SELECT COALESCE(SUM(duration_hours), 0) AS s FROM sessions WHERE user_id = ?${clientFilter}`, sessParams),
    db.get(`SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?${clientFilter} AND flagged = 1`, sessParams),
    db.get(
      `SELECT synced_at FROM sync_log WHERE user_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1`,
      [userId],
    ),
  ]);

  const totalEarned = Math.round(Number(earnedRow.s) * 100) / 100;
  const totalPaid   = Math.round(Number(paidRow.s) * 100) / 100;
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

async function getMonthlyBreakdown(db, userId, clientId) {
  // Determine work_cycle_start_day and payment due days: prefer per-client, fall back to defaults
  let startDay = 25;
  let dueStartDay = 1;
  let dueEndDay = 5;
  if (clientId) {
    const client = await db.get('SELECT work_cycle_start_day, payment_due_start_day, payment_due_end_day FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
    if (client) {
      startDay = Number(client.work_cycle_start_day) || 25;
      dueStartDay = Number(client.payment_due_start_day) || 1;
      dueEndDay = Number(client.payment_due_end_day) || 5;
    }
  }

  const clientFilter = clientId ? ' AND client_id = ?' : '';
  const baseParams = clientId ? [userId, clientId] : [userId];

  const monthRows = await db.all(
    `SELECT salary_month AS sm FROM sessions WHERE user_id = ?${clientFilter} AND salary_month IS NOT NULL GROUP BY salary_month`,
    baseParams,
  );

  const unique = [...new Set(monthRows.map((r) => r.sm))].sort(
    (a, b) => monthSortKey(a, startDay) - monthSortKey(b, startDay),
  );

  const payments = await db.all(
    `SELECT date, amount_egp FROM payments WHERE user_id = ?${clientFilter} ORDER BY date ASC`,
    baseParams,
  );

  const rows = [];
  let cumEarned = 0;

  for (const salaryMonth of unique) {
    const agg = await db.get(
      `SELECT COUNT(*) AS c, COALESCE(SUM(duration_hours),0) AS h, COALESCE(SUM(earnings),0) AS e
       FROM sessions WHERE user_id = ?${clientFilter} AND salary_month = ?`,
      [...baseParams, salaryMonth],
    );

    const expected = Math.round(Number(agg.e) * 100) / 100;
    const hours    = Math.round(Number(agg.h) * 100) / 100;
    cumEarned = Math.round((cumEarned + expected) * 100) / 100;

    const { start, end } = getCycleRange(salaryMonth, startDay);
    const cycleEnd = parse(end, 'yyyy-MM-dd', new Date());
    let cumPaid = 0;
    for (const p of payments) {
      if (parse(p.date, 'yyyy-MM-dd', new Date()) <= cycleEnd) cumPaid += Number(p.amount_egp);
    }
    cumPaid = Math.round(cumPaid * 100) / 100;

    const startD = parse(start, 'yyyy-MM-dd', new Date());
    const { paymentDueStart, paymentDueEnd, paymentDueLabel } = getPaymentDueWindow(salaryMonth, dueStartDay, dueEndDay);
    rows.push({
      salaryMonth,
      salaryLabel: `${salaryMonth} Salary`,
      cyclePeriod: `${format(startD, 'MMM d', { locale: enUS })} – ${format(cycleEnd, 'MMM d, yyyy', { locale: enUS })}`,
      cycleStart: start,
      cycleEnd: end,
      paymentDueStart,
      paymentDueEnd,
      paymentDueLabel,
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
