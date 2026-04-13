/**
 * Parse iCalendar (.ics) text into the same event shape used by calendarService / calculator.
 * Skips all-day events and entries without a usable time range.
 */
const ical = require('node-ical');
const { formatInTimeZone } = require('date-fns-tz');
const { enUS } = require('date-fns/locale');

/**
 * @param {string} icsText - Raw .ics file contents
 * @param {string} tz - IANA timezone from config (e.g. Africa/Cairo)
 * @param {{ from?: string, to?: string }} [range] - Optional YYYY-MM-DD filter (inclusive)
 * @returns {Array<{ calendarEventId: string, title: string, date: string, dayOfWeek: string, startTime: string, endTime: string, durationHours: number }>}
 */
function parseIcsToEvents(icsText, tz, range = {}) {
  if (!icsText || typeof icsText !== 'string') {
    return [];
  }

  let parsed;
  try {
    parsed = ical.parseICS(icsText);
  } catch (e) {
    const err = new Error(`Invalid ICS file: ${e.message}`);
    err.status = 400;
    throw err;
  }

  const out = [];
  const fromD = range.from ? new Date(`${range.from}T00:00:00`) : null;
  const toD = range.to ? new Date(`${range.to}T23:59:59.999`) : null;

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    if (ev.rrule) continue; // skip recurring definitions (export usually expands instances)

    const start = ev.start instanceof Date ? ev.start : ev.start ? new Date(ev.start) : null;
    let end = ev.end instanceof Date ? ev.end : ev.end ? new Date(ev.end) : null;

    if (!start || !start.getTime()) continue;

    // All-day / date-only events
    if (ev.datetype === 'date') continue;

    if (!end || !end.getTime()) {
      if (ev.duration && typeof ev.duration === 'number') {
        end = new Date(start.getTime() + ev.duration * 1000);
      } else {
        continue;
      }
    }

    const durationMs = end.getTime() - start.getTime();
    if (durationMs <= 0) continue;
    const durationHours = Math.round((durationMs / 3600000) * 100) / 100;
    if (durationHours <= 0 || durationHours > 168) continue; // max 1 week single block

    const dateStr = formatInTimeZone(start, tz, 'yyyy-MM-dd');
    if (fromD && dateStr < range.from) continue;
    if (toD && dateStr > range.to) continue;

    const dayOfWeek = formatInTimeZone(start, tz, 'EEEE', { locale: enUS });
    const uid = ev.uid ? String(ev.uid).replace(/\s/g, '') : `ics-${key}`;
    const calendarEventId = `ics:${uid}:${start.getTime()}`;

    out.push({
      calendarEventId,
      title: (ev.summary && String(ev.summary).trim()) || '(no title)',
      date: dateStr,
      dayOfWeek,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHours,
    });
  }

  return out;
}

module.exports = { parseIcsToEvents };
