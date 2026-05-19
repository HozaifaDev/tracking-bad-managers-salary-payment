const { randomUUID } = require('crypto');
const { format, parse, addMonths, addDays } = require('date-fns');
const { enUS } = require('date-fns/locale');
const { formatInTimeZone } = require('date-fns-tz');
const { DateTime } = require('luxon');

// ─── Cycle helpers ───────────────────────────────────────────────────────────

function getSalaryMonth(dateStr, startDay = 25) {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (d.getDate() >= startDay) {
    const ref = addMonths(d, 1);
    return format(ref, 'MMMM yyyy', { locale: enUS });
  }
  return format(d, 'MMMM yyyy', { locale: enUS });
}

function getCycleRange(salaryMonthLabel, startDay = 25) {
  const endMonthDate = parse(salaryMonthLabel, 'MMMM yyyy', new Date(), { locale: enUS });
  const y = endMonthDate.getFullYear();
  const m = endMonthDate.getMonth();
  const end = new Date(y, m, startDay - 1);
  const start = addDays(addMonths(end, -1), 1);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

/**
 * Compute the payment due window for a salary cycle.
 * The payment is due between the `dueStart`th and `dueEnd`th of the month
 * AFTER the cycle ends.
 *
 * @param {string} salaryMonthLabel - e.g. "April 2025"
 * @param {number} [dueStart=1] - Day of month when payment window opens (default 1)
 * @param {number} [dueEnd=5] - Day of month when payment window closes (default 5)
 * @returns {{ paymentDueStart: string, paymentDueEnd: string, paymentDueLabel: string }}
 */
function getPaymentDueWindow(salaryMonthLabel, dueStart = 1, dueEnd = 5) {
  const endMonthDate = parse(salaryMonthLabel, 'MMMM yyyy', new Date(), { locale: enUS });
  const paymentMonth = addMonths(endMonthDate, 1);
  const y = paymentMonth.getFullYear();
  const m = paymentMonth.getMonth();
  const paymentDueStart = format(new Date(y, m, dueStart), 'yyyy-MM-dd');
  const paymentDueEnd = format(new Date(y, m, dueEnd), 'yyyy-MM-dd');
  const paymentDueLabel = `${format(new Date(y, m, dueStart), 'MMM d', { locale: enUS })} – ${format(new Date(y, m, dueEnd), 'MMM d, yyyy', { locale: enUS })}`;
  return { paymentDueStart, paymentDueEnd, paymentDueLabel };
}

// ─── Generic work-type logic ──────────────────────────────────────────────────

/**
 * Find the best-matching work type from the client's work_types array.
 * Exact name match wins; falls back to case-insensitive contains.
 */
function matchWorkType(title, workTypes = []) {
  if (!workTypes.length) return null;
  const lower = String(title || '').toLowerCase();
  for (const wt of workTypes) {
    if (wt.name.toLowerCase() === lower) return wt;
  }
  for (const wt of workTypes) {
    if (lower.includes(wt.name.toLowerCase())) return wt;
  }
  return null;
}

/**
 * Match a title against import mappings (keyword-based).
 * Returns the first mapping whose keyword is found in the title (case-insensitive).
 * Also extracts a sub-category if delimiter is found after the keyword.
 *
 * @param {string} title - The event title
 * @param {Array<{ keyword: string, workTypeName: string, rateType: string, rate: number, delimiter?: string }>} mappings
 * @returns {{ mapping: object, subCategory: string|null } | null}
 */
function matchWorkTypeByKeyword(title, mappings = []) {
  if (!mappings || !mappings.length) return null;
  const t = String(title || '').trim();
  const lower = t.toLowerCase();
  for (const m of mappings) {
    const kw = String(m.keyword || '').trim();
    if (!kw) continue;
    if (lower.includes(kw.toLowerCase())) {
      const delimiter = m.delimiter || ' - ';
      let subCategory = null;
      const kwStartIdx = lower.indexOf(kw.toLowerCase());
      const afterKw = t.slice(kwStartIdx + kw.length);
      if (afterKw.startsWith(delimiter)) {
        subCategory = afterKw.slice(delimiter.length).trim() || null;
      }
      return { mapping: m, subCategory };
    }
  }
  return null;
}

/**
 * Detect if a title signals a completed milestone ("COMPLETE" / "DONE" suffix).
 */
function titleIsComplete(title) {
  const last = String(title || '').trim().split(' - ').pop().toUpperCase();
  return last === 'COMPLETE' || last === 'DONE';
}

/**
 * Calculate earnings from a matched work type.
 *   hourly      → rate × durationHours
 *   per_session → flat rate
 *   milestone   → rate only when isComplete, else 0
 */
function calcEarnings(durationHours, workType, isComplete = false) {
  if (!workType) return 0;
  switch (workType.rate_type) {
    case 'hourly':      return Math.round(durationHours * (workType.rate || 0) * 100) / 100;
    case 'per_session': return workType.rate || 0;
    case 'milestone':   return isComplete ? (workType.rate || 0) : 0;
    default:            return 0;
  }
}

// ─── Legacy helpers (kept for backward-compat title parsing) ─────────────────

function classifyTitle(title) {
  const t = String(title || '').trim();
  const lower = t.toLowerCase();

  if (lower.includes('diploma:')) {
    const rest = t.split(':').slice(1).join(':').trim();
    const parts = rest.split(' - ').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const complete = ['COMPLETE', 'DONE'].includes(last.toUpperCase());
    let track = '';
    let milestone = '';
    if (complete && parts.length >= 2) {
      milestone = parts[parts.length - 2];
      track = parts.slice(0, -2).join(' - ') || parts[0];
    } else if (parts.length >= 2) {
      track = parts[0];
      milestone = parts[1];
    } else if (parts.length === 1) {
      track = parts[0];
    }
    return { category: 'Diploma', subCategory: track, milestone, isMilestoneComplete: complete };
  }

  if (lower.includes('private course:')) {
    const rest = t.split(':').slice(1).join(':').trim();
    const parts = rest.split(' - ').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const complete = ['COMPLETE', 'DONE'].includes(last.toUpperCase());
    let courseKey = '';
    if (complete && parts.length > 1) courseKey = parts.slice(0, -1).join(' - ');
    else courseKey = parts[0] || rest;
    return { category: 'Private Course', subCategory: courseKey, milestone: null, isMilestoneComplete: complete };
  }

  if (lower.includes('group a')) return { category: 'Group A', subCategory: null, milestone: null, isMilestoneComplete: false };
  if (lower.includes('group b')) return { category: 'Group B', subCategory: null, milestone: null, isMilestoneComplete: false };

  return { category: 'Uncategorized', subCategory: null, milestone: null, isMilestoneComplete: false };
}

function findDiplomaPayout(config, track, milestone) {
  const diplomas = config.diplomas || {};
  for (const [tName, tData] of Object.entries(diplomas)) {
    if (tName.trim().toLowerCase() !== String(track).trim().toLowerCase()) continue;
    const ms = (tData && tData.milestones) || {};
    for (const [mName, amount] of Object.entries(ms)) {
      if (mName.trim().toLowerCase() === String(milestone).trim().toLowerCase()) return Number(amount);
    }
  }
  return null;
}

function findPrivateOverride(overrides, courseKey, fullTitle) {
  if (!overrides || typeof overrides !== 'object') return null;
  const candidates = [courseKey, fullTitle].filter(Boolean);
  for (const [key, val] of Object.entries(overrides)) {
    const kl = key.toLowerCase().trim();
    for (const c of candidates) {
      const cl = String(c).toLowerCase().trim();
      if (!cl) continue;
      if (cl === kl || kl.includes(cl) || cl.includes(kl)) return val;
    }
  }
  return null;
}

// ─── Core session builder ─────────────────────────────────────────────────────

/**
 * Build a session row ready for DB insert.
 *
 * clientConfig shape:
 *   { work_cycle_start_day, timezone, currency, work_types: [{name, rate_type, rate, color}] }
 *
 * importMapping (optional) shape:
 *   { keyword, workTypeName, rateType, rate, delimiter }
 *   When provided, takes priority over work_types matching.
 *   Extracts sub_category from the title using keyword + delimiter.
 *
 * When work_types is populated the new generic logic runs.
 * When empty / absent, falls back to legacy classifyTitle + config.groups / diplomas / private_courses.
 */
function buildSessionRow(rawEvent, clientConfig = {}, importMapping = null) {
  const startDay = Number(clientConfig.work_cycle_start_day) || 25;
  const title = rawEvent.title;
  const dateStr = rawEvent.date;
  const durationHours = Math.round(Number(rawEvent.durationHours) * 100) / 100;
  const workTypes = clientConfig.work_types || [];

  const salaryMonth = getSalaryMonth(dateStr, startDay);
  const { start: cycleStart, end: cycleEnd } = getCycleRange(salaryMonth, startDay);

  // ── Import mapping path (highest priority) ─────────────────────────────────
  if (importMapping) {
    const kwResult = matchWorkTypeByKeyword(title, [importMapping]);
    const m = kwResult ? kwResult.mapping : importMapping;
    const subCategory = kwResult ? kwResult.subCategory : null;
    const isComplete = titleIsComplete(title);
    const workType = { name: m.workTypeName, rate_type: m.rateType, rate: m.rate };
    const earnings = calcEarnings(durationHours, workType, isComplete);
    const rateApplied = workType.rate_type === 'hourly' ? (workType.rate || 0) : 0;
    let note = '';
    if (workType.rate_type === 'milestone' && !isComplete) {
      note = `${workType.name} — payout on completion`;
    }

    return {
      calendar_event_id: rawEvent.calendarEventId,
      title,
      date: dateStr,
      day_of_week: rawEvent.dayOfWeek,
      start_time: rawEvent.startTime,
      end_time: rawEvent.endTime,
      duration_hours: durationHours,
      category: workType.name,
      sub_category: subCategory,
      milestone: workType.rate_type === 'milestone' ? title : null,
      is_milestone_complete: isComplete ? 1 : 0,
      rate_applied: rateApplied,
      earnings,
      salary_month: salaryMonth,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      note,
      flagged: 0,
    };
  }

  // ── New generic path ────────────────────────────────────────────────────────
  if (workTypes.length > 0) {
    const matched = matchWorkType(title, workTypes);
    const isComplete = titleIsComplete(title);

    if (!matched) {
      return {
        calendar_event_id: rawEvent.calendarEventId,
        title,
        date: dateStr,
        day_of_week: rawEvent.dayOfWeek,
        start_time: rawEvent.startTime,
        end_time: rawEvent.endTime,
        duration_hours: durationHours,
        category: 'Uncategorized',
        sub_category: null,
        milestone: null,
        is_milestone_complete: 0,
        rate_applied: 0,
        earnings: 0,
        salary_month: salaryMonth,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        note: 'No matching work type — review and edit manually',
        flagged: 1,
      };
    }

    const earnings = calcEarnings(durationHours, matched, isComplete);
    const rateApplied = matched.rate_type === 'hourly' ? (matched.rate || 0) : 0;
    let note = '';
    if (matched.rate_type === 'milestone' && !isComplete) {
      note = `${matched.name} — payout on completion`;
    }

    return {
      calendar_event_id: rawEvent.calendarEventId,
      title,
      date: dateStr,
      day_of_week: rawEvent.dayOfWeek,
      start_time: rawEvent.startTime,
      end_time: rawEvent.endTime,
      duration_hours: durationHours,
      category: matched.name,
      sub_category: null,
      milestone: matched.rate_type === 'milestone' ? title : null,
      is_milestone_complete: isComplete ? 1 : 0,
      rate_applied: rateApplied,
      earnings,
      salary_month: salaryMonth,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      note,
      flagged: 0,
    };
  }

  // ── Legacy path (no work_types configured) ──────────────────────────────────
  const classified = classifyTitle(title);
  let rateApplied = 0;
  let earnings = 0;
  let note = '';
  let flagged = classified.category === 'Uncategorized';

  const groups = clientConfig.groups || {};
  const pc = clientConfig.private_courses || {};
  const split = Number(pc.default_split_instructor) || 0.5;
  const defaultHr = Number(pc.default_hourly_rate) || 300;
  const overrides = pc.overrides || {};

  if (classified.category === 'Group A') {
    rateApplied = Number(groups['Group A']?.rate_per_hour) || 0;
    earnings = Math.round(durationHours * rateApplied * 100) / 100;
  } else if (classified.category === 'Group B') {
    rateApplied = Number(groups['Group B']?.rate_per_hour) || 0;
    earnings = Math.round(durationHours * rateApplied * 100) / 100;
  } else if (classified.category === 'Private Course') {
    const override = findPrivateOverride(overrides, classified.subCategory, title);
    if (classified.isMilestoneComplete) {
      if (override && override.fixed_instructor_amount != null) {
        earnings = Number(override.fixed_instructor_amount);
        note = 'Fixed deal override (course complete)';
      } else {
        earnings = 0;
        note = 'COMPLETE event; no fixed override — per-session earnings already counted';
      }
    } else if (override && override.fixed_instructor_amount != null) {
      earnings = 0;
      note = 'Fixed course — payout on COMPLETE event only';
    } else {
      rateApplied = defaultHr;
      earnings = Math.round(durationHours * defaultHr * split * 100) / 100;
      note = `Split ${Math.round(split * 100)}% of ${defaultHr} EGP/hr assumed total`;
    }
  } else if (classified.category === 'Diploma') {
    if (classified.isMilestoneComplete) {
      const payout = findDiplomaPayout(clientConfig, classified.subCategory, classified.milestone);
      if (payout != null) {
        earnings = payout;
        note = `Milestone payout: ${classified.milestone}`;
      } else {
        note = `No payout for track "${classified.subCategory}", milestone "${classified.milestone}"`;
        flagged = true;
      }
    } else {
      note = 'Diploma session (milestone paid on COMPLETE/Done)';
    }
  }

  return {
    calendar_event_id: rawEvent.calendarEventId,
    title,
    date: dateStr,
    day_of_week: rawEvent.dayOfWeek,
    start_time: rawEvent.startTime,
    end_time: rawEvent.endTime,
    duration_hours: durationHours,
    category: classified.category,
    sub_category: classified.subCategory,
    milestone: classified.milestone,
    is_milestone_complete: classified.isMilestoneComplete ? 1 : 0,
    rate_applied: rateApplied,
    earnings,
    salary_month: salaryMonth,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    note,
    flagged: flagged ? 1 : 0,
  };
}

// ─── Manual session builder ───────────────────────────────────────────────────

function buildManualRawEvent({ date, title, durationHours, workTypeName, isComplete, note }, clientConfig = {}) {
  const tz = clientConfig.timezone || 'Africa/Cairo';
  const dur = Number(durationHours);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    const err = new Error('date must be YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  const resolvedTitle = String(workTypeName || title || '').trim();
  if (!resolvedTitle) {
    const err = new Error('title or workTypeName is required');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(dur) || dur <= 0 || dur > 168) {
    const err = new Error('durationHours must be a positive number up to 168');
    err.status = 400;
    throw err;
  }

  // Append COMPLETE suffix for milestone types so the row is built correctly
  const workTypes = clientConfig.work_types || [];
  const matched = matchWorkType(resolvedTitle, workTypes);
  let finalTitle = resolvedTitle;
  if (matched && matched.rate_type === 'milestone' && isComplete) {
    finalTitle = `${resolvedTitle} - COMPLETE`;
  }

  const start = DateTime.fromISO(`${date}T09:00:00`, { zone: tz });
  if (!start.isValid) {
    const err = new Error('invalid date');
    err.status = 400;
    throw err;
  }
  const end = start.plus({ hours: dur });
  const startJs = start.toJSDate();
  const endJs = end.toJSDate();

  return {
    calendarEventId: `manual-${randomUUID()}`,
    title: finalTitle,
    date: String(date),
    manualNote: note ? String(note).trim() : null,
    dayOfWeek: formatInTimeZone(startJs, tz, 'EEEE', { locale: enUS }),
    startTime: startJs.toISOString(),
    endTime: endJs.toISOString(),
    durationHours: Math.round(dur * 100) / 100,
  };
}

module.exports = {
  getSalaryMonth,
  getCycleRange,
  getPaymentDueWindow,
  classifyTitle,
  matchWorkType,
  matchWorkTypeByKeyword,
  calcEarnings,
  buildSessionRow,
  buildManualRawEvent,
  findDiplomaPayout,
};
