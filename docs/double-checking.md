# Double-Checking & Verification

Checklists and verification steps for each feature area.

---

## ICS Import Verification

- [ ] Upload a `.ics` file with recurring events → should expand RRULE into individual instances
- [ ] Paste raw ICS text → should parse and preview correctly
- [ ] Date range filter: leave both fields empty → should return all events
- [ ] Date range filter: set specific range → should filter to that range only
- [ ] Map a title to an existing work type → should auto-detect on future imports
- [ ] Map a title to a new work type → should create it on the client
- [ ] Skip all unmatched → should flag remaining as uncategorized
- [ ] Verify import count matches preview count
- [ ] Check that RRULE expansion produces correct event count (was 1, should be 465+)
- [ ] Import with override dates (modified/cancelled instances) → should respect exceptions

## Payment Due Window Verification

- [ ] Default client (no due days set) → should show "May 1 – May 5, 2025" for April 2025 Salary
- [ ] Custom due days (e.g. 10–15) → should show "May 10 – May 15, 2025"
- [ ] December cycle (next month is January next year) → should roll year correctly
- [ ] Client with cycle start day 1 (same month cycle) → payment due should still be next month
- [ ] Update client payment due days → should reflect in monthly breakdown immediately

## Salary Label Verification

- [ ] Monthly table shows "April 2025 Salary" not "April 2025"
- [ ] Dashboard chart x-axis shows salary labels
- [ ] Invoice PDF shows "April 2025 Salary" in header
- [ ] Demand letter shows salary label in overdue table
- [ ] Excel report has "Salary Month" column with full label

## Pro Plan Gate Verification

- [ ] Free user: can create 1 client, blocked from more
- [ ] Pro user with active subscription: can create unlimited clients
- [ ] Pro user with cancelled subscription (still in period): can create unlimited clients
- [ ] Manually-set pro user (null subscription status): can create unlimited clients
- [ ] Expired pro user: falls back to free tier limits

## Build Verification

- [ ] `node -e "require('./services/calculatorService'); ..."` — all backend modules load without error
- [ ] `npx vite build` — frontend builds without errors
- [ ] Server starts and migration runs idempotently (no crash on existing columns)
- [ ] `getPaymentDueWindow()` returns correct results for edge cases (year boundary, different day ranges)