const ExcelJS = require('exceljs');
const { getDatabase } = require('../db/database');
const { getAllTimeSummary, getMonthlyBreakdown } = require('./balancerService');

const EGP_FMT = '#,##0.00 "EGP"';

async function buildWorkbook({ from, to, userId } = {}) {
  const db = await getDatabase();
  const summary = await getAllTimeSummary(db, userId);
  const monthly = await getMonthlyBreakdown(db, userId);

  let sessionSql = 'SELECT * FROM sessions WHERE user_id = ?';
  const params = [userId];
  if (from) { sessionSql += ' AND date >= ?'; params.push(from); }
  if (to) { sessionSql += ' AND date <= ?'; params.push(to); }
  sessionSql += ' ORDER BY date ASC, id ASC';

  const sessions = await db.all(sessionSql, params);
  const payments = await db.all(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY date ASC, id ASC',
    [userId],
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hours & Salary Tracker';

  // Summary sheet
  const ws1 = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws1.mergeCells('A1:B1');
  ws1.getCell('A1').value = 'Hours & Salary Tracker — Report';
  ws1.getCell('A1').font = { bold: true, size: 14 };
  ws1.getCell('A3').value = 'Generated';
  ws1.getCell('B3').value = new Date().toISOString();
  ws1.getCell('A4').value = 'Total Earned'; ws1.getCell('B4').value = summary.totalEarned; ws1.getCell('B4').numFmt = EGP_FMT;
  ws1.getCell('A5').value = 'Total Paid';   ws1.getCell('B5').value = summary.totalPaid;   ws1.getCell('B5').numFmt = EGP_FMT;
  ws1.getCell('A6').value = 'Balance Owed'; ws1.getCell('B6').value = summary.balance;     ws1.getCell('B6').numFmt = EGP_FMT;
  const balCell = ws1.getCell('B6');
  const argb = summary.balance > 0 ? 'FFFFCCCC' : summary.balance < 0 ? 'FFCCCCFF' : 'FFCCFFCC';
  balCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };

  // Monthly sheet
  const ws2 = wb.addWorksheet('Monthly Breakdown', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws2.addRow(['Salary Month', 'Cycle Period', 'Sessions', 'Hours', 'Expected Earnings', 'Cumulative Earned', 'Cumulative Paid', 'Running Balance']);
  ws2.getRow(1).font = { bold: true };
  monthly.forEach((m, i) => {
    const r = ws2.addRow([m.salaryMonth, m.cyclePeriod, m.sessionsCount, m.totalHours, m.expectedEarnings, m.cumulativeEarned, m.cumulativePaid, m.runningBalance]);
    if (i % 2 === 1) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; });
    const bal = r.getCell(8);
    bal.numFmt = EGP_FMT;
    if (m.runningBalance > 0) bal.font = { color: { argb: 'FFCC0000' } };
    [5, 6, 7, 8].forEach((c) => { r.getCell(c).numFmt = EGP_FMT; });
  });

  // Sessions sheet
  const ws3 = wb.addWorksheet('Session Log', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws3.addRow(['Date', 'Day', 'Salary Month', 'Title', 'Category', 'Hours', 'Rate', 'Earnings', 'Note', 'Flagged']);
  ws3.getRow(1).font = { bold: true };
  sessions.forEach((s, i) => {
    const r = ws3.addRow([s.date, s.day_of_week, s.salary_month, s.title, s.category, s.duration_hours, s.rate_applied, s.earnings, s.note || '', s.flagged ? 'Yes' : 'No']);
    if (s.flagged) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }; });
    r.getCell(7).numFmt = EGP_FMT;
    r.getCell(8).numFmt = EGP_FMT;
  });

  // Payments sheet
  const ws4 = wb.addWorksheet('Payment Log', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws4.addRow(['Date', 'Amount (EGP)', 'Note', 'Running Total']);
  ws4.getRow(1).font = { bold: true };
  let running = 0;
  payments.forEach((p) => {
    running += Number(p.amount_egp);
    const r = ws4.addRow([p.date, p.amount_egp, p.note || '', running]);
    r.getCell(2).numFmt = EGP_FMT;
    r.getCell(4).numFmt = EGP_FMT;
  });

  [ws1, ws2, ws3, ws4].forEach((ws) => {
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 50);
    });
  });

  return wb;
}

module.exports = { buildWorkbook };
