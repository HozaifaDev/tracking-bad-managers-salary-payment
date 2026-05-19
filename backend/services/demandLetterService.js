const PDFDocument = require('pdfkit');
const { differenceInDays, parse } = require('date-fns');
const { getDatabase } = require('../db/database');
const { getMonthlyBreakdown } = require('./balancerService');

const ROSE    = '#e11d48';
const ROSE_LT = '#fff1f2';
const SLATE9  = '#0f172a';
const SLATE7  = '#334155';
const SLATE5  = '#64748b';
const LINE    = '#e2e8f0';

function fmt(n, currency = 'EGP') {
  return Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

function drawHRule(doc, y, color = LINE) {
  doc.save().moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

function tableRow(doc, cols, y, widths, options = {}) {
  const { bold = false, bg = null, color = SLATE9, fontSize = 9 } = options;
  if (bg) doc.save().rect(50, y - 2, doc.page.width - 100, 16).fill(bg).restore();
  doc.fontSize(fontSize).fillColor(color);
  let x = 50;
  cols.forEach((text, i) => {
    const w = widths[i];
    const align = i >= 2 ? 'right' : 'left';
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(String(text ?? ''), x, y, { width: w, align, lineBreak: false });
    x += w;
  });
}

async function buildDemandLetterPdf({ userId, clientId }) {
  const db = await getDatabase();

  // Resolve client
  let client = null;
  if (clientId) {
    client = await db.get('SELECT * FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
  } else {
    client = await db.get('SELECT * FROM clients WHERE user_id = ? AND is_default = 1', [userId]);
  }

  const currency = client?.currency || 'EGP';
  const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [userId]);

  // Get all monthly cycles for this client
  const monthly = await getMonthlyBreakdown(db, userId, client ? client.id : null);
  const today = new Date();

  // Only overdue cycles (balance owed and cycle has ended)
  const overdue = monthly
    .filter((m) => {
      if (m.runningBalance <= 0) return false;
      const cycleEnd = parse(m.cycleEnd, 'yyyy-MM-dd', new Date());
      return cycleEnd < today;
    })
    .map((m) => ({
      ...m,
      daysOverdue: differenceInDays(today, parse(m.cycleEnd, 'yyyy-MM-dd', new Date())),
    }));

  if (overdue.length === 0) {
    throw Object.assign(new Error('No overdue cycles found — nothing to dispute.'), { status: 400 });
  }

  const totalOutstanding = Math.round(overdue.reduce((s, m) => s + m.runningBalance, 0) * 100) / 100;

  // Sessions from overdue months for evidence
  const overdueMonths = overdue.map((m) => m.salaryMonth);
  const placeholders = overdueMonths.map(() => '?').join(', ');
  const clientFilter = client ? ' AND client_id = ?' : '';
  const sessParams = client
    ? [userId, client.id, ...overdueMonths]
    : [userId, ...overdueMonths];

  const sessions = await db.all(
    `SELECT * FROM sessions
     WHERE user_id = ?${clientFilter} AND salary_month IN (${placeholders})
     ORDER BY date ASC`,
    sessParams,
  );

  // Build PDF
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const clientName = client?.name || 'Client';
  const senderName = user.name || user.email;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 80).fill(ROSE);
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff').text('PAYMENT DEMAND LETTER', 50, 22);
  doc.fontSize(9).font('Helvetica').fillColor('#fecdd3').text(`Salary Tracker  •  ${dateStr}`, 50, 52);

  // ── From / To ────────────────────────────────────────────────────────────────
  let y = 105;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(SLATE5).text('FROM', 50, y);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(SLATE5).text('TO', 320, y);
  y += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text(senderName, 50, y);
  doc.fontSize(9).font('Helvetica').fillColor(SLATE7).text(user.email, 50, y + 14);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text(clientName, 320, y);
  y += 36;
  drawHRule(doc, y);

  // ── Subject line ─────────────────────────────────────────────────────────────
  y += 16;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(ROSE)
    .text(`RE: Formal Demand for Outstanding Payment — ${fmt(totalOutstanding, currency)}`, 50, y, { width: doc.page.width - 100 });
  y += 30;
  drawHRule(doc, y);

  // ── Letter body ──────────────────────────────────────────────────────────────
  y += 16;
  const bodyText = [
    `Dear ${clientName},`,
    '',
    'This letter constitutes a formal demand for payment of outstanding compensation owed for professional services rendered. Despite the completion of all agreed work, the following amounts remain unpaid.',
    '',
    'The outstanding balance is itemised below. Immediate settlement is required.',
  ];

  for (const line of bodyText) {
    if (line === '') { y += 8; continue; }
    doc.fontSize(10).font(line.startsWith('Dear') ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(SLATE9).text(line, 50, y, { width: doc.page.width - 100 });
    y += 16;
  }

  y += 8;

  // ── Overdue cycles table ──────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('OUTSTANDING CYCLES', 50, y);
  y += 16;

  const OW = [90, 76, 76, 76, 76, 100, 86];
  tableRow(doc, ['Salary Month', 'Expected', 'Paid', 'Outstanding', 'Days Overdue', 'Cycle Ended', 'Payment Due'],
    y, OW, { bold: true, bg: '#fff1f2', fontSize: 8 });
  y += 18;

  overdue.forEach((m, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    tableRow(
      doc,
      [m.salaryLabel || m.salaryMonth, fmt(m.expectedEarnings, currency), fmt(m.cumulativePaid, currency),
       fmt(m.runningBalance, currency), `${m.daysOverdue}d`, m.cycleEnd, m.paymentDueLabel || ''],
      y, OW,
      { bg: i % 2 === 1 ? '#fafafa' : null, color: i >= 0 ? SLATE9 : SLATE9, fontSize: 8 },
    );
    y += 15;
  });

  // Total row
  y += 4;
  drawHRule(doc, y, ROSE);
  y += 8;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(ROSE)
    .text(`Total Outstanding: ${fmt(totalOutstanding, currency)}`, 50, y, { align: 'right', width: doc.page.width - 100 });
  y += 24;

  // ── Payment demand ────────────────────────────────────────────────────────────
  doc.save().rect(50, y - 4, doc.page.width - 100, 46).fill(ROSE_LT).restore();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(ROSE)
    .text('PAYMENT DUE', 62, y);
  y += 16;
  doc.fontSize(9).font('Helvetica').fillColor(SLATE9)
    .text(`You are hereby requested to remit the full outstanding amount of ${fmt(totalOutstanding, currency)} within 7 days of the date of this letter. Failure to respond may result in escalation through formal dispute or legal proceedings.`, 62, y, { width: doc.page.width - 124 });
  y += 38;

  drawHRule(doc, y);

  // ── Evidence: session breakdown ───────────────────────────────────────────────
  y += 14;
  if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
  doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE9).text('SUPPORTING EVIDENCE — SESSION LOG', 50, y);
  y += 6;
  doc.fontSize(8).font('Helvetica').fillColor(SLATE5)
    .text('All sessions worked during the disputed cycles.', 50, y + 8);
  y += 22;

  const SW = [62, 120, 70, 55, 55, 70, 60];
  tableRow(doc, ['Date', 'Title', 'Work Type', 'Day', 'Hours', 'Rate', 'Earnings'],
    y, SW, { bold: true, bg: '#f1f5f9', fontSize: 8 });
  y += 18;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    tableRow(
      doc,
      [s.date, s.title, s.category, s.day_of_week || '', s.duration_hours.toFixed(2),
       fmt(s.rate_applied, currency), fmt(s.earnings, currency)],
      y, SW, { bg: i % 2 === 1 ? '#f8fafc' : null, fontSize: 8 },
    );
    y += 15;
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 40;
  drawHRule(doc, footerY - 10);
  doc.fontSize(8).font('Helvetica').fillColor(SLATE5)
    .text('Generated by Salary Tracker — This document serves as a formal notice of outstanding payment.',
      50, footerY, { align: 'center', width: doc.page.width - 100 });

  doc.end();
  return new Promise((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))); });
}

module.exports = { buildDemandLetterPdf };
