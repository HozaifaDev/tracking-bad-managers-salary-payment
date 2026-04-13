import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parse, parseISO, addMonths, addDays } from 'date-fns';
import { enGB, enUS } from 'date-fns/locale';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** UI: "24,350 EGP" */
export function formatCurrency(value, currency = 'EGP') {
  const n = Number(value);
  const formatted = n.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

/** DB date YYYY-MM-DD → "13 Jan 2025" */
export function formatDateUi(dateStr) {
  if (!dateStr) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? parse(dateStr, 'yyyy-MM-dd', new Date())
    : parseISO(String(dateStr));
  return format(d, 'dd MMM yyyy', { locale: enGB });
}

export function formatDurationHours(h) {
  return `${Number(h).toFixed(2)} hrs`;
}

/** Salary month label for a Date (same rules as backend). */
export function salaryMonthLabelForDate(d, startDay = 25) {
  const ref = d.getDate() >= startDay ? addMonths(d, 1) : d;
  return format(ref, 'MMMM yyyy', { locale: enUS });
}

/** Cycle [start,end] inclusive for a salary month label. */
export function cycleRangeForLabel(label, startDay = 25) {
  const endMonthDate = parse(label, 'MMMM yyyy', new Date(), { locale: enUS });
  const y = endMonthDate.getFullYear();
  const mo = endMonthDate.getMonth();
  const end = new Date(y, mo, startDay - 1);
  const start = addDays(addMonths(end, -1), 1);
  return { start, end };
}

/** Default sync range: current salary cycle start through today (capped at cycle end). */
export function getDefaultSyncRange(startDay = 25) {
  const today = new Date();
  const label = salaryMonthLabelForDate(today, startDay);
  const { start, end } = cycleRangeForLabel(label, startDay);
  const endCap = today.getTime() <= end.getTime() ? today : end;
  return {
    from: format(start, 'yyyy-MM-dd'),
    to: format(endCap, 'yyyy-MM-dd'),
  };
}
