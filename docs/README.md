# Hours Tracker — Project Documentation

Everything we've done, why we did it, and what we verified along the way.

## Directory Structure

```
docs/
  README.md                 ← You are here (index)
  approaches/               ← Design decisions and technical approaches
    smart-ics-import.md       How we built the smart ICS import wizard
    cycle-salary-labeling.md  How cycle names and salary labels work
    payment-due-window.md      How per-client payment due windows work
  bugs-and-fixes.md         ← Every bug found, root cause, and fix
  enhancement-log.md       ← Feature-by-feature changelog
  double-checking.md        ← Verification checklists and smoke tests
  reviews.md                ← Design/code reviews and their outcomes
```

## Quick Reference

| Topic | File |
|---|---|
| ICS import: preview, map, confirm flow | [approaches/smart-ics-import.md](approaches/smart-ics-import.md) |
| "April 2025 Salary" label format | [approaches/cycle-salary-labeling.md](approaches/cycle-salary-labeling.md) |
| Per-client payment due windows | [approaches/payment-due-window.md](approaches/payment-due-window.md) |
| Bugs and their root causes | [bugs-and-fixes.md](bugs-and-fixes.md) |
| What shipped and when | [enhancement-log.md](enhancement-log.md) |
| Verification steps | [double-checking.md](double-checking.md) |
| Design and code reviews | [reviews.md](reviews.md) |

## Key Architecture Decisions

1. **Node-ical for ICS parsing** — v0.20.1, supports RRULE expansion via `ev.rrule.between()`
2. **SQLite with idempotent migrations** — ALTER TABLE wrapped in try/catch so re-runs are safe
3. **Per-client payment due days** — `payment_due_start_day` / `payment_due_end_day` columns on `clients` table, defaulting to 1 and 5
4. **Salary label format** — "April 2025 Salary" (not just "April 2025") computed by `salaryLabelForDate()` in frontend and `getSalaryMonth()` in backend
5. **Pro plan gating** — `ls_subscription_status` is null for manually-set pro users; fixed `isPro` check to allow `!status`
6. **Import workflow** — Three-phase wizard: Upload → Map → Confirm. Unmatched events never silently import
7. **Uncategorized sessions** — Flagged with `flagged: '1'`, deletable in bulk via `DELETE /api/sessions/uncategorized`

## Conventions

- Sub-category delimiter is configurable per import (default ` - `)
- Mapped categories auto-save as work types on the client for future imports
- All salary-month labels follow the format `{Month} {Year} Salary`
- Payment due always falls in the month *after* the salary cycle ends
- Frontend uses `@tanstack/react-query`, `sonner` for toasts, Radix/shadcn UI components