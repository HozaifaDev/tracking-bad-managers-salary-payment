# Cycle & Salary Labeling

## Problem

Monthly cycles were labeled as just "April 2025" — ambiguous and not distinctive enough. Users needed to clearly see that a cycle represents a *salary period*, not just a calendar month. Additionally, the cycle period dates (start day to end day) were not explicitly shown.

## Approach

### Salary Label Format

Changed from `April 2025` → `April 2025 Salary`

The word "Salary" is appended by `salaryLabelForDate()` on the frontend and `getSalaryMonth()` on the backend. Both produce the same format:

```
April 2025 Salary
```

This label appears in:
- Monthly breakdown table (replaces the raw `salaryMonth` column)
- Dashboard charts (x-axis labels)
- Invoice PDFs (header and summary)
- Demand letters (overdue table)

### Cycle Period Display

Each monthly row now includes a `cyclePeriod` string like:

```
Mar 25 – Apr 24, 2025
```

This is computed from the client's `work_cycle_start_day` and the salary month date, making it clear exactly which dates the cycle covers.

## Key Files

| File | Change |
|---|---|
| `backend/services/calculatorService.js` | `getSalaryMonth()` returns `{ label: "April 2025 Salary", month: "April 2025" }` |
| `backend/services/balancerService.js` | Each monthly row includes `salaryLabel` and `cyclePeriod` |
| `frontend/src/lib/utils.js` | `salaryLabelForDate()` — appends " Salary" to the month label |
| `frontend/src/pages/Monthly.jsx` | Shows "April 2025 Salary" as the first column |
| `frontend/src/pages/Dashboard.jsx` | Chart x-axis uses `salaryLabel` instead of `salaryMonth` |
| `backend/services/invoiceService.js` | PDF header shows salary label |
| `backend/services/demandLetterService.js` | Overdue table shows salary label |
| `backend/services/reportService.js` | Excel sheet shows salary label |

## Design Decision

Why not make it configurable? Because "Salary" is the domain term — this app tracks salary periods. Every cycle is a salary cycle. Making the suffix configurable would add complexity for no real use case. If we ever support non-salary cycle types (e.g. "April 2025 Invoice"), we can revisit.