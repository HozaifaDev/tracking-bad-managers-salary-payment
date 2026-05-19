const { buildSessionRow, matchWorkTypeByKeyword } = require('./calculatorService');

/**
 * Insert raw calendar-shaped events into sessions (dedupe by user_id + calendar_event_id).
 *
 * @param {object} db           - async DB adapter
 * @param {Array}  rawEvents
 * @param {number} userId
 * @param {number} clientId     - which client these sessions belong to
 * @param {object} clientConfig - parsed config_json from the clients table
 * @param {object} [options]   - optional overrides
 * @param {Array}  [options.mappings]    - import mapping overrides [{ keyword, workTypeName, rateType, rate, delimiter }]
 * @param {Array}  [options.skippedTitles] - titles to skip entirely
 */
async function applyRawEventsToDatabase(db, rawEvents, userId, clientId, clientConfig = {}, options = {}) {
  const { mappings = [], skippedTitles = [] } = options;
  const skippedSet = new Set(skippedTitles.map((t) => String(t).trim().toLowerCase()));

  let newCount = 0;
  let skipped = 0;
  let skippedByUser = 0;
  const flaggedTitles = new Set();
  const mappingBreakdown = new Map();

  await db.transaction(async (tx) => {
    for (const ev of rawEvents) {
      const titleLower = String(ev.title).trim().toLowerCase();

      if (skippedSet.has(titleLower)) {
        skippedByUser += 1;
        continue;
      }

      const existing = await tx.get(
        'SELECT id FROM sessions WHERE user_id = ? AND calendar_event_id = ?',
        [userId, ev.calendarEventId],
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      let importMapping = null;
      if (mappings.length > 0) {
        const kwResult = matchWorkTypeByKeyword(ev.title, mappings);
        if (kwResult) {
          importMapping = kwResult.mapping;
        }
      }

      const row = buildSessionRow(ev, clientConfig, importMapping);

      const { lastId } = await tx.run(
        `INSERT INTO sessions (
          user_id, client_id, calendar_event_id, title, date, day_of_week, start_time, end_time,
          duration_hours, category, sub_category, milestone, is_milestone_complete,
          rate_applied, earnings, salary_month, cycle_start, cycle_end, note, flagged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          clientId,
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
          ev.manualNote || row.note,
          row.flagged,
        ],
      );

      newCount += 1;
      if (row.flagged) flaggedTitles.add(row.title);

      if (importMapping) {
        const key = importMapping.workTypeName;
        const prev = mappingBreakdown.get(key) || { events: 0, hours: 0, earnings: 0 };
        prev.events += 1;
        prev.hours += row.duration_hours;
        prev.earnings += row.earnings;
        mappingBreakdown.set(key, prev);
      }

      // Diploma progress tracking (legacy path — sub_category + milestone populated)
      if (row.sub_category && row.milestone && row.is_milestone_complete) {
        await tx.run(
          `INSERT INTO diploma_progress (user_id, client_id, track, milestone, completed, completion_date, payout_earned, session_id)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(user_id, track, milestone) DO UPDATE SET
             completed = excluded.completed,
             completion_date = excluded.completion_date,
             payout_earned = excluded.payout_earned,
             session_id = excluded.session_id`,
          [userId, clientId, row.sub_category, row.milestone, row.date, row.earnings, lastId],
        );
      }
    }
  });

  return {
    newCount,
    skipped,
    skippedByUser,
    flaggedTitles,
    mappingBreakdown: Object.fromEntries(
      [...mappingBreakdown.entries()].map(([key, val]) => [key, {
        events: val.events,
        hours: Math.round(val.hours * 100) / 100,
        earnings: Math.round(val.earnings * 100) / 100,
      }]),
    ),
  };
}

module.exports = { applyRawEventsToDatabase };
