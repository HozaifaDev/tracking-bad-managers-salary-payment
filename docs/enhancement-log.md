# Enhancement Log

Chronological record of features shipped and changes made.

---

## 2026-05 — Smart ICS Import & Payment Accountability

### Smart ICS Import Wizard
- **Preview endpoint** (`POST /ics/preview`): parses ICS, expands RRULE, returns unique titles and date range
- **Confirm endpoint** (`POST /ics/confirm`): processes events with user-provided mappings and skipped titles
- **Frontend wizard**: 3-phase UI (Upload → Map → Result) with drag-and-drop file upload and paste support
- **Auto-mapping**: `matchWorkTypeByKeyword()` suggests work type assignments based on keyword matching
- **Persisted mappings**: mapped categories auto-save to client's `work_types` for future imports
- **Unmatched resolution**: "Skip all unmatched" button + individual title assignment
- **Bulk delete**: `DELETE /api/sessions/uncategorized` removes all flagged uncategorized sessions

### Cycle & Salary Labeling
- Salary month labels now show "April 2025 Salary" instead of just "April 2025"
- `salaryLabelForDate()` in `frontend/src/lib/utils.js`
- `getSalaryMonth()` in `backend/services/calculatorService.js`
- Dashboard charts use salary labels on x-axis
- Monthly breakdown table shows salary label as first column
- Invoice PDFs and demand letters use salary labels

### Payment Due Window
- Per-client configurable payment due days (`payment_due_start_day` default 1, `payment_due_end_day` default 5)
- Database migration added both columns to `clients` table
- `getPaymentDueWindow()` computes due dates in the month *after* the cycle
- Payment due labels appear in: Monthly table, Invoice PDF, Demand letter, Excel report
- Client editor form has start/end day inputs with descriptions
- Client list cards show "due 1–5" in subtitle

### Bug Fixes
- Fixed RRULE expansion skipping all recurring events (1 → 465 events)
- Fixed ICS date range filter treating empty strings as truthy
- Fixed pro plan check for manually-set users (`!status` case)
- Made SQLite ALTER TABLE migrations idempotent with try/catch

### Files Changed
- `backend/services/icsImportService.js` — ICS parsing, RRULE expansion, title extraction
- `backend/services/calculatorService.js` — salary labels, payment due window, work type matching
- `backend/services/balancerService.js` — monthly breakdown with salary labels + payment due
- `backend/services/sessionSyncLogic.js` — import mapping + skipped titles
- `backend/services/invoiceService.js` — payment due line on invoice
- `backend/services/demandLetterService.js` — payment due column
- `backend/services/reportService.js` — payment due column in Excel
- `backend/routes/import.js` — preview + confirm endpoints
- `backend/routes/sessions.js` — uncategorized sessions delete endpoint
- `backend/routes/clients.js` — payment due fields in mapClient + update
- `backend/routes/billing.js` — fixed isPro gate
- `backend/db/migrations.js` — payment_due_start_day / payment_due_end_day columns
- `frontend/src/pages/Sync.jsx` — SmartImportWizard + UncategorizedBanner
- `frontend/src/pages/Monthly.jsx` — payment due column + salary labels
- `frontend/src/pages/Dashboard.jsx` — salary labels in charts
- `frontend/src/pages/Clients.jsx` — payment due day fields in editor
- `frontend/src/lib/api.js` — preview/confirm/delete API functions
- `frontend/src/lib/utils.js` — getPaymentDueWindow + salaryLabelForDate