/**
 * Parse iCalendar (.ics) text into the same event shape used by calendarService / calculator.
 * Skips all-day events and entries without a usable time range.
 * Expands recurring events (RRULE) into individual instances.
 */
const ical = require('node-ical');
const { formatInTimeZone } = require('date-fns-tz');
const { enUS } = require('date-fns/locale');

/**
 * Build an event object from a VEVENT component.
 */
function buildEventFromVEvent(ev, tz, overrideStart) {
  const start = overrideStart || (ev.start instanceof Date ? ev.start : ev.start ? new Date(ev.start) : null);
  if (!start || !start.getTime()) return null;

  const durationMs = ev.end && ev.end.getTime
    ? (ev.end.getTime() - (ev.start instanceof Date ? ev.start : new Date(ev.start)).getTime())
    : null;

  let end = null;
  let durationHours = 0;

  if (durationMs && durationMs > 0) {
    end = new Date(start.getTime() + durationMs);
    durationHours = Math.round((durationMs / 3600000) * 100) / 100;
  } else if (ev.duration && typeof ev.duration === 'number') {
    end = new Date(start.getTime() + ev.duration * 1000);
    durationHours = Math.round((ev.duration / 3600) * 100) / 100;
  } else {
    return null;
  }

  if (durationHours <= 0 || durationHours > 168) return null;

  const dateStr = formatInTimeZone(start, tz, 'yyyy-MM-dd');
  const dayOfWeek = formatInTimeZone(start, tz, 'EEEE', { locale: enUS });
  const uid = (ev.uid ? String(ev.uid).replace(/\s/g, '') : `ics-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  return {
    calendarEventId: `ics:${uid}:${start.getTime()}`,
    title: (ev.summary && String(ev.summary).trim()) || '(no title)',
    date: dateStr,
    dayOfWeek,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationHours,
  };
}

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
  const fromStr = range.from || null;
  const toStr = range.to || null;

  // Use a wide range for recurring event expansion (3 years back, 2 years forward)
  const expandFrom = fromStr ? new Date(`${fromStr}T00:00:00`) : new Date(new Date().getFullYear() - 3, 0, 1);
  const expandTo = toStr ? new Date(`${toStr}T23:59:59.999`) : new Date(new Date().getFullYear() + 2, 11, 31);

  // Track override instances by (uid + date) to prioritize them over expanded recurrences
  const overrideKeys = new Set();

  // First pass: collect override instances (RECURRENCE-ID) first
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    if (ev.rrule) continue; // skip template — we expand these separately
    if (ev.datetype === 'date') continue; // all-day events

    const start = ev.start instanceof Date ? ev.start : ev.start ? new Date(ev.start) : null;
    if (!start || !start.getTime()) continue;

    // Mark override instances so expanded recurrences don't duplicate them
    if (ev.recurrenceid) {
      const uid = ev.uid ? String(ev.uid).replace(/\s/g, '') : '';
      const overrideKey = `${uid}:${start.getTime()}`;
      overrideKeys.add(overrideKey);
    }

    const evt = buildEventFromVEvent(ev, tz);
    if (!evt) continue;

    if (fromStr && evt.date < fromStr) continue;
    if (toStr && evt.date > toStr) continue;

    out.push(evt);
  }

  // Second pass: expand recurring events (RRULE)
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    if (!ev.rrule) continue; // only process recurring templates here
    if (ev.datetype === 'date') continue;

    const uid = ev.uid ? String(ev.uid).replace(/\s/g, '') : '';
    const templateStart = ev.start instanceof Date ? ev.start : ev.start ? new Date(ev.start) : null;
    if (!templateStart || !templateStart.getTime()) continue;

    let durationMs = null;
    if (ev.end && ev.end.getTime && (ev.end instanceof Date)) {
      durationMs = ev.end.getTime() - templateStart.getTime();
    } else if (ev.duration && typeof ev.duration === 'number') {
      durationMs = ev.duration * 1000;
    }
    const durationHours = durationMs ? Math.round((durationMs / 3600000) * 100) / 100 : 0;
    if (durationHours <= 0 || durationHours > 168) continue;

    // Expand the RRULE into individual dates
    let dates = [];
    try {
      if (typeof ev.rrule.between === 'function') {
        dates = ev.rrule.between(expandFrom, expandTo, true);
      } else if (typeof ev.rrule.all === 'function') {
        dates = ev.rrule.all();
      }
    } catch (_) {
      // If RRULE expansion fails, fall back to just the template start
      dates = [templateStart];
    }

    for (const date of dates) {
      const dt = date instanceof Date ? date : new Date(date);
      if (!dt || !dt.getTime()) continue;

      const overrideKey = `${uid}:${dt.getTime()}`;
      if (overrideKeys.has(overrideKey)) continue; // skip — override instance takes priority

      const dateStr = formatInTimeZone(dt, tz, 'yyyy-MM-dd');
      if (fromStr && dateStr < fromStr) continue;
      if (toStr && dateStr > toStr) continue;

      const dayOfWeek = formatInTimeZone(dt, tz, 'EEEE', { locale: enUS });
      const evtEnd = new Date(dt.getTime() + durationMs);
      const evt = {
        calendarEventId: `ics:${uid}:${dt.getTime()}`,
        title: (ev.summary && String(ev.summary).trim()) || '(no title)',
        date: dateStr,
        dayOfWeek,
        startTime: dt.toISOString(),
        endTime: evtEnd.toISOString(),
        durationHours,
      };

      out.push(evt);
    }
  }

  // Deduplicate by calendarEventId (shouldn't normally happen, but safety net)
  const seen = new Set();
  const deduped = [];
  for (const evt of out) {
    if (seen.has(evt.calendarEventId)) continue;
    seen.add(evt.calendarEventId);
    deduped.push(evt);
  }

  return deduped;
}

/**
 * Extract unique titles from parsed events with counts.
 * @param {Array<{ title: string, date: string, durationHours: number }>} events
 * @returns {{ uniqueTitles: Array<{ title: string, count: number }>, totalEvents: number, dateRange: { from: string|null, to: string|null } }}
 */
function extractUniqueTitles(events) {
  const titleMap = new Map();
  let minDate = null;
  let maxDate = null;

  for (const ev of events) {
    const count = titleMap.get(ev.title) || 0;
    titleMap.set(ev.title, count + 1);
    if (!minDate || ev.date < minDate) minDate = ev.date;
    if (!maxDate || ev.date > maxDate) maxDate = ev.date;
  }

  const uniqueTitles = [];
  for (const [title, count] of titleMap) {
    uniqueTitles.push({ title, count });
  }
  uniqueTitles.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  return {
    uniqueTitles,
    totalEvents: events.length,
    dateRange: { from: minDate, to: maxDate },
  };
}

/**
 * Detect groups of titles that share a common prefix when split by delimiter.
 * @param {Array<{ title: string, count: number }>} uniqueTitles
 * @param {string} [delimiter=' - ']
 * @returns {Array<{ keyword: string, titles: string[], totalEvents: number }>}
 */
function detectTitleGroups(uniqueTitles, delimiter = ' - ') {
  const groupMap = new Map();

  for (const { title, count } of uniqueTitles) {
    const idx = title.indexOf(delimiter);
    let keyword;
    if (idx > 0) {
      keyword = title.slice(0, idx).trim();
    } else {
      keyword = title.trim();
    }

    if (!groupMap.has(keyword)) {
      groupMap.set(keyword, { keyword, titles: [], totalEvents: 0 });
    }
    const group = groupMap.get(keyword);
    group.titles.push(title);
    group.totalEvents += count;
  }

  const groups = [...groupMap.values()];
  groups.sort((a, b) => b.totalEvents - a.totalEvents || a.keyword.localeCompare(b.keyword));
  return groups;
}

module.exports = { parseIcsToEvents, extractUniqueTitles, detectTitleGroups };