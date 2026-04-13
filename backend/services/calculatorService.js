/**
 * Classifies calendar titles and computes per-session earnings + salary cycle fields.
 * Mirrors the Python CLI rules: groups, private courses (fixed on COMPLETE), diplomas.
 */
const {
  format,
  parse,
  addMonths,
  addDays,
} = require('date-fns');
const { enUS } = require('date-fns/locale');

/**
 * Salary month label e.g. "December 2024" from a calendar date string YYYY-MM-DD.
 */
function getSalaryMonth(dateStr, startDay = 25) {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (d.getDate() >= startDay) {
    const ref = addMonths(d, 1);
    return format(ref, 'MMMM yyyy', { locale: enUS });
  }
  return format(d, 'MMMM yyyy', { locale: enUS });
}

/**
 * Cycle bounds for a salary month label (inclusive).
 */
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
    return {
      category: 'Diploma',
      subCategory: track,
      milestone,
      isMilestoneComplete: complete,
    };
  }

  if (lower.includes('private course:')) {
    const rest = t.split(':').slice(1).join(':').trim();
    const parts = rest.split(' - ').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const complete = ['COMPLETE', 'DONE'].includes(last.toUpperCase());
    let courseKey = '';
    if (complete && parts.length > 1) {
      courseKey = parts.slice(0, -1).join(' - ');
    } else {
      courseKey = parts[0] || rest;
    }
    return {
      category: 'Private Course',
      subCategory: courseKey,
      milestone: null,
      isMilestoneComplete: complete,
    };
  }

  if (lower.includes('group a')) {
    return { category: 'Group A', subCategory: null, milestone: null, isMilestoneComplete: false };
  }
  if (lower.includes('group b')) {
    return { category: 'Group B', subCategory: null, milestone: null, isMilestoneComplete: false };
  }

  return {
    category: 'Uncategorized',
    subCategory: null,
    milestone: null,
    isMilestoneComplete: false,
  };
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

function findDiplomaPayout(config, track, milestone) {
  const diplomas = config.diplomas || {};
  for (const [tName, tData] of Object.entries(diplomas)) {
    if (tName.trim().toLowerCase() !== String(track).trim().toLowerCase()) continue;
    const ms = (tData && tData.milestones) || {};
    for (const [mName, amount] of Object.entries(ms)) {
      if (mName.trim().toLowerCase() === String(milestone).trim().toLowerCase()) {
        return Number(amount);
      }
    }
  }
  return null;
}

/**
 * Build a row object ready for SQLite insert (snake_case keys matching columns).
 */
function buildSessionRow(rawEvent, config) {
  const startDay = Number(config.work_cycle_start_day) || 25;
  const title = rawEvent.title;
  const dateStr = rawEvent.date;
  const durationHours = Math.round(Number(rawEvent.durationHours) * 100) / 100;

  const classified = classifyTitle(title);
  const salaryMonth = getSalaryMonth(dateStr, startDay);
  const { start: cycleStart, end: cycleEnd } = getCycleRange(salaryMonth, startDay);

  let rateApplied = 0;
  let earnings = 0;
  let note = '';
  let flagged = classified.category === 'Uncategorized';

  const groups = config.groups || {};
  const pc = config.private_courses || {};
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
      const totalSession = durationHours * defaultHr;
      earnings = Math.round(totalSession * split * 100) / 100;
      note = `Split ${Math.round(split * 100)}% of ${defaultHr} EGP/hr assumed total`;
    }
  } else if (classified.category === 'Diploma') {
    if (classified.isMilestoneComplete) {
      const payout = findDiplomaPayout(config, classified.subCategory, classified.milestone);
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

module.exports = {
  getSalaryMonth,
  getCycleRange,
  classifyTitle,
  buildSessionRow,
  findDiplomaPayout,
};
