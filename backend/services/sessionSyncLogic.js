/**
 * Insert raw calendar-shaped events into sessions (dedupe by calendar_event_id).
 * Used by Google sync, ICS import, and manual session creation.
 */
const { readConfig } = require('./configService');
const { buildSessionRow } = require('./calculatorService');

/**
 * @param {*} db - DatabaseSync (node:sqlite)
 * @param {Array<object>} rawEvents - same shape as fetchCalendarEvents / parseIcsToEvents
 * @returns {{ newCount: number, skipped: number, flaggedTitles: Set<string> }}
 */
function applyRawEventsToDatabase(db, rawEvents) {
  const config = readConfig();
  let newCount = 0;
  let skipped = 0;
  const flaggedTitles = new Set();

  const existsStmt = db.prepare('SELECT id FROM sessions WHERE calendar_event_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO sessions (
      calendar_event_id, title, date, day_of_week, start_time, end_time, duration_hours,
      category, sub_category, milestone, is_milestone_complete, rate_applied, earnings,
      salary_month, cycle_start, cycle_end, note, flagged
    ) VALUES (
      @calendar_event_id, @title, @date, @day_of_week, @start_time, @end_time, @duration_hours,
      @category, @sub_category, @milestone, @is_milestone_complete, @rate_applied, @earnings,
      @salary_month, @cycle_start, @cycle_end, @note, @flagged
    )
  `);

  const upsertDiploma = db.prepare(`
    INSERT INTO diploma_progress (track, milestone, completed, completion_date, payout_earned, session_id)
    VALUES (@track, @milestone, 1, @completion_date, @payout, @session_id)
    ON CONFLICT(track, milestone) DO UPDATE SET
      completed = excluded.completed,
      completion_date = excluded.completion_date,
      payout_earned = excluded.payout_earned,
      session_id = excluded.session_id
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const ev of rawEvents) {
      if (existsStmt.get(ev.calendarEventId)) {
        skipped += 1;
        continue;
      }
      const row = buildSessionRow(ev, config);
      const info = insertStmt.run(row);
      newCount += 1;
      if (row.flagged) flaggedTitles.add(row.title);

      if (row.category === 'Diploma' && row.is_milestone_complete && row.sub_category && row.milestone) {
        upsertDiploma.run({
          track: row.sub_category,
          milestone: row.milestone,
          completion_date: row.date,
          payout: row.earnings,
          session_id: Number(info.lastInsertRowid),
        });
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  }

  return { newCount, skipped, flaggedTitles };
}

module.exports = { applyRawEventsToDatabase };
