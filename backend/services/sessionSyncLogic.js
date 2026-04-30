const { readConfig } = require('./configService');
const { buildSessionRow } = require('./calculatorService');

/**
 * Insert raw calendar-shaped events into sessions (dedupe by user_id + calendar_event_id).
 * @param {object} db - async DB adapter
 * @param {Array}  rawEvents
 * @param {number} userId
 */
async function applyRawEventsToDatabase(db, rawEvents, userId) {
  const config = readConfig();
  let newCount = 0;
  let skipped = 0;
  const flaggedTitles = new Set();

  await db.transaction(async (tx) => {
    for (const ev of rawEvents) {
      const existing = await tx.get(
        'SELECT id FROM sessions WHERE user_id = ? AND calendar_event_id = ?',
        [userId, ev.calendarEventId],
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const row = buildSessionRow(ev, config);

      const { lastId } = await tx.run(
        `INSERT INTO sessions (
          user_id, calendar_event_id, title, date, day_of_week, start_time, end_time,
          duration_hours, category, sub_category, milestone, is_milestone_complete,
          rate_applied, earnings, salary_month, cycle_start, cycle_end, note, flagged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          row.calendar_event_id,
          row.title,
          row.date,
          row.day_of_week,
          row.start_time,
          row.end_time,
          row.duration_hours,
          row.category,
          row.sub_category,
          row.milestone,
          row.is_milestone_complete,
          row.rate_applied,
          row.earnings,
          row.salary_month,
          row.cycle_start,
          row.cycle_end,
          row.note,
          row.flagged,
        ],
      );

      newCount += 1;
      if (row.flagged) flaggedTitles.add(row.title);

      if (row.category === 'Diploma' && row.is_milestone_complete && row.sub_category && row.milestone) {
        await tx.run(
          `INSERT INTO diploma_progress (user_id, track, milestone, completed, completion_date, payout_earned, session_id)
           VALUES (?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(user_id, track, milestone) DO UPDATE SET
             completed = excluded.completed,
             completion_date = excluded.completion_date,
             payout_earned = excluded.payout_earned,
             session_id = excluded.session_id`,
          [userId, row.sub_category, row.milestone, row.date, row.earnings, lastId],
        );
      }
    }
  });

  return { newCount, skipped, flaggedTitles };
}

module.exports = { applyRawEventsToDatabase };
