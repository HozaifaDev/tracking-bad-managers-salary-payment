const PDFDocument = require('pdfkit');
const { parse } = require('date-fns');
const { getDatabase } = require('../db/database');
const { getMonthlyBreakdown } = require('./balancerService');
const { getCycleRange, getPaymentDueWindow } = require('./calculatorService');

const INDIGO = '#4f46e5';
const SLATE9 = '#0f172a';
const SLATE5 = '#64748b';
const ROSE   = '#e11d48';
const EMRALD = '#059669';
const LINE   = '#e2e8f0';

function fmt(n, currency = 'EGP') {
  return Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

function drawHRule(doc, y, color = LINE) {
  doc.save().moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

function tableRow(doc, cols, y, widths, options = {}) {
  const { bold = false, bg = null, color = SLATE9, fontSize = 9 } = options;
  if (bg) {
    doc.save().rect(50, y - 2, doc.page.width - 100, 16).fill(bg).restore();
  }
  doc.fontSize(fontSize).fillColor(color);
  let x = 50;
  cols.forEach((text, i) => {
    const w = widths[i];
    const align = (i === cols.length - 1 || i >= 2) ? 'right' : 'left';
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.text(String(text ?? ''), x, y, { width: w, align, lineBreak: false });
    x += w;
  });
}

async function buildInvoicePdf({ userId, salaryMonth, clientId }) {
  const db = await getDatabase();

  // Resolve client: explicit clientId or user's default
  let client = null;
  if (clientId) {
    client = await db.get('SELECT * FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
  } else {
    client = await db.get('SELECT * FROM clients WHERE user_id = ? AND is_default = 1', [userId]);
  }

  let clientConfig = {};
  if (client) {
    try { clientConfig = JSON.parse(client.config_json || '{}'); } catch (_) {}
  }
  const currency = (client && client.currency) || clientConfig.currency || 'EGP';
  const startDay = (client && client.work_cycle_start_day) || Number(clientConfig.work_cycle_start_day) || 25;
  const dueStartDay = (client && client.payment_due_start_day) || 1;
  const dueEndDay = (client && client.payment_due_end_day) || 5;

  const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [userId]);
  const { start, end } = getCycleRange(salaryMonth, startDay);
  const { paymentDueStart, paymentDueEnd, paymentDueLabel } = getPaymentDueWindow(salaryMonth, dueStartDay, dueEndDay);

  const sessionFilter = client
    ? 'user_id = ? AND client_id = ? AND salary_month = ?'
    : 'user_id = ? AND salary_month = ?';
  const sessionParams = client
    ? [userId, client.id, salaryMonth]
    : [userId, salaryMonth];

  const sessions = await db.all(
    `SELECT * FROM sessions WHERE ${sessionFilter} ORDER BY date ASC, id ASC`,
    sessionParams,
  );

  const monthly = await getMonthlyBreakdown(db, userId, client ? client.id : null);
  const cycleData = monthly.find((m) => m.salaryMonth === salaryMonth);
  if (!cycleData) throw new Error(`No data found for salary month: ${salaryMonth}`);

  const paymentFilter = client
    ? 'user_id = ? AND client_id = ? AND date <= ?'
    : 'user_id = ? AND date <= ?';
  const paymentParams = client ? [userId, client.id, end] : [userId, end];

  const payments = await db.all(
    `SELECT * FROM payments WHERE ${paymentFilter} ORDER BY date ASC`,
    paymentParams,
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(INDIGO);
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text('SALARY INVOICE', 50, 24);
  doc.fontSize(9).font('Helvetica').fillColor('#c7d2fe')
    .text(`Salary Tracker  •  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, 50, 52);

  // Invoice meta
  let y = 105;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('INVOICE TO', 50, y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('BILLING PERIOD', 320, y);

  y += 16;
  doc.fontSize(9).font('Helvetica').fillColor(SLATE9)
    .text(user.name || user.email, 50, y)
    .text(user.email, 50, y + 13);

  if (client) {
    doc.fontSize(9).font('Helvetica').fillColor(SLATE5).text(`Client: ${client.name}`, 50, y + 26);
  }

  doc.fontSize(9).font('Helvetica').fillColor(SLATE9)
    .text(cycleData.cyclePeriod, 320, y)
    .text(`Salary month: ${salaryMonth}`, 320, y + 13)
    .text(`Payment due: ${paymentDueLabel}`, 320, y + 26);

  y += client ? 68 : 56;
  drawHRule(doc, y);

  // Summary
  y += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('SUMMARY', 50, y);
  y += 16;

  const summaryItems = [
    ['Sessions', cycleData.sessionsCount],
    ['Total hours', cycleData.totalHours.toFixed(2) + ' hrs'],
    ['Earned this cycle', fmt(cycleData.expectedEarnings, currency)],
    ['Cumulative paid (to cycle end)', fmt(cycleData.cumulativePaid, currency)],
  ];
  summaryItems.forEach(([label, value]) => {
    doc.fontSize(9).font('Helvetica').fillColor(SLATE5).text(label, 50, y, { continued: false });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(SLATE9).text(value, 230, y, { align: 'left' });
    y += 16;
  });

  const balance = cycleData.runningBalance;
  const balColor = balance > 0 ? ROSE : EMRALD;
  const balLabel = balance > 0 ? 'Outstanding balance' : 'Overpaid / credit';
  doc.fontSize(9).font('Helvetica').fillColor(SLATE5).text(balLabel, 50, y);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(balColor).text(fmt(Math.abs(balance), currency), 230, y);
  y += 20;

  drawHRule(doc, y);

  // Session table
  y += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('SESSION BREAKDOWN', 50, y);
  y += 16;
  const SW = [62, 130, 55, 55, 60, 50, 70];
  tableRow(doc, ['Date', 'Title', 'Category', 'Day', 'Hours', 'Rate', 'Earnings'], y, SW, { bold: true, bg: '#f1f5f9', fontSize: 8 });
  y += 18;
  sessions.forEach((s, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    tableRow(
      doc,
      [s.date, s.title, s.category, s.day_of_week || '', s.duration_hours.toFixed(2), fmt(s.rate_applied, currency), fmt(s.earnings, currency)],
      y, SW, { bg: i % 2 === 1 ? '#f8fafc' : null, fontSize: 8 },
    );
    y += 15;
  });
  if (sessions.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(SLATE5).text('No sessions recorded for this cycle.', 50, y);
    y += 15;
  }
  y += 8;
  drawHRule(doc, y);

  // Payments table
  y += 14;
  if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('PAYMENTS RECEIVED (up to cycle end)', 50, y);
  y += 16;
  const PW = [80, 130, 282];
  tableRow(doc, ['Date', 'Amount', 'Note'], y, PW, { bold: true, bg: '#f1f5f9', fontSize: 8 });
  y += 18;
  payments.forEach((p, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    tableRow(doc, [p.date, fmt(p.amount_egp, currency), p.note || ''], y, PW, { bg: i % 2 === 1 ? '#f8fafc' : null, fontSize: 8 });
    y += 15;
  });
  if (payments.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(SLATE5).text('No payments received up to this cycle end.', 50, y);
    y += 15;
  }

  // Footer
  const footerY = doc.page.height - 40;
  drawHRule(doc, footerY - 10);
  doc.fontSize(8).font('Helvetica').fillColor(SLATE5)
    .text('Generated by Salary Tracker', 50, footerY, { align: 'center', width: doc.page.width - 100 });

  doc.end();
  return new Promise((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))); });
}

module.exports = { buildInvoicePdf };
