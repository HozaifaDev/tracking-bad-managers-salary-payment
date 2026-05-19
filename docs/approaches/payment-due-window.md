# Payment Due Window

## Problem

Users needed to know *when* their salary payment is due, not just *how much* they're owed. Payment deadlines vary per client — some pay on the 1st, others by the 5th, others by the 10th. This information should appear everywhere: invoices, demand letters, monthly breakdowns, and Excel reports.

## Approach

### Per-Client Configuration

Added two columns to the `clients` table:

| Column | Type | Default | Description |
|---|---|---|---|
| `payment_due_start_day` | INTEGER | 1 | Day of month when the payment window opens |
| `payment_due_end_day` | INTEGER | 5 | Day of month when the payment window closes |

These represent days in the month *after* the salary cycle ends. For an April 2025 Salary cycle (ending April 24), payment is due May 1–5.

### Computation

`getPaymentDueWindow(salaryMonthLabel, dueStart, dueEnd)` in `calculatorService.js`:

1. Parse the salary month label back to a Date
2. Calculate the next month
3. Construct `paymentDueStart` = next month + `dueStartDay`
4. Construct `paymentDueEnd` = next month + `dueEndDay`
5. Return `{ paymentDueStart, paymentDueEnd, paymentDueLabel }`

Example outputs:
```
getPaymentDueWindow("April 2025", 1, 5)
// → { paymentDueStart: "2025-05-01", paymentDueEnd: "2025-05-05", paymentDueLabel: "May 1 – May 5, 2025" }

getPaymentDueWindow("March 2026", 10, 15)
// → { paymentDueStart: "2026-04-10", paymentDueEnd: "2026-04-15", paymentDueLabel: "Apr 10 – Apr 15, 2026" }
```

### Frontend Utility

`getPaymentDueWindow(cycleStartDay, dueStartDay, dueEndDay, year, month)` in `frontend/src/lib/utils.js` mirrors the backend logic for client-side display.

### Where It Appears

| Surface | What's shown |
|---|---|
| Monthly breakdown table | "May 1 – May 5, 2025" column |
| Invoice PDF | "Payment due: May 1 – May 5, 2025" |
| Demand letter | "Payment Due" column in overdue table |
| Excel report | "Payment Due" column in Monthly Breakdown sheet |
| Client editor | Start day / End day inputs with helper text |
| Client list card | "due 1–5" in subtitle |

## Database Migration

```sql
ALTER TABLE clients ADD COLUMN payment_due_start_day INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN payment_due_end_day INTEGER DEFAULT 5;
```

Wrapped in try/catch in `migrations.js` for idempotent re-runs (SQLite doesn't support `IF NOT EXISTS` on `ALTER TABLE`).

## Key Files

| File | Change |
|---|---|
| `backend/db/migrations.js` | Added both columns |
| `backend/services/calculatorService.js` | `getPaymentDueWindow()` |
| `backend/services/balancerService.js` | Reads per-client due days, adds `salaryLabel`, `paymentDueStart`, `paymentDueEnd`, `paymentDueLabel` |
| `backend/services/invoiceService.js` | Shows payment due line on invoice |
| `backend/services/demandLetterService.js` | Payment Due column in overdue table |
| `backend/services/reportService.js` | Payment Due column in Excel |
| `backend/routes/clients.js` | `mapClient()` returns both fields; PUT route saves both |
| `frontend/src/pages/Monthly.jsx` | Payment due column in table |
| `frontend/src/pages/Clients.jsx` | Payment due fields in client editor form |
| `frontend/src/lib/utils.js` | `getPaymentDueWindow()` and `salaryLabelForDate()` |