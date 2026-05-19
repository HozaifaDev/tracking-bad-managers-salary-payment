# Checklist — Session Verification & Remaining Items

> Originally created May 2026. Items marked with ✅ have been implemented.

---

## 1. ICS Re-import Duplication [VERIFICATION — HIGH]

**What to check:** If the same `.ics` file is imported twice, does it create duplicate sessions?

**Current behavior:** `applyRawEventsToDatabase()` deduplicates via `calendar_event_id`:

```js
// sessionSyncLogic.js:34-41
const existing = await tx.get(
  'SELECT id FROM sessions WHERE user_id = ? AND calendar_event_id = ?',
  [userId, ev.calendarEventId],
);
if (existing) { skipped += 1; continue; }
```

Theoretically safe — same `ics:{uid}:{timestamp}` ID = same event = skipped. But potential gaps:

1. **Different calendarEventId format** on re-import would bypass dedup
2. **Manual sessions** with `manual-{uuid}` IDs won't collide (correct behavior)

**What to verify:**
- [ ] Import a `.ics` file, then import it again. Session count should stay the same
- [ ] Import same `.ics` with different date range. Verify no duplicates
- [ ] DB check: `SELECT calendar_event_id, COUNT(*) FROM sessions GROUP BY calendar_event_id HAVING COUNT(*) > 1`
- [ ] DB check: `SELECT title, date, start_time, COUNT(*) FROM sessions WHERE user_id = ? GROUP BY title, date, start_time HAVING COUNT(*) > 1`

---

## 2. Notification Bell Shows Wrong Owed Number ✅ FIXED

**Bug:** `notifications.js` summed all overdue `runningBalance` values, but `runningBalance` is already cumulative. Summing them double-counted earlier cycles.

**Fix:** Changed to use the last overdue cycle's `runningBalance` (which already includes all prior cycles):

```js
// BEFORE (wrong):
totalOwed: overdueCycles.reduce((sum, m) => sum + m.runningBalance, 0),
// AFTER (correct):
totalOwed: overdueCycles.length > 0
  ? overdueCycles[overdueCycles.length - 1].runningBalance
  : 0,
```

Also added `expectedEarnings` and `salaryLabel` to the notification response, and per-cycle display now shows "X earned this cycle" below the owed amount.

---

## 3. Earnings Calculation & Deleted Events [PARTIALLY FIXED]

### 3a. Wrong earnings (hours × rate ≠ shown earnings) — NEEDS VERIFICATION

Possible causes:
- **Rate type mismatch**: `per_session` uses flat rate, not hourly. 2.5hrs × 200 for `per_session` = 200 (flat), not 500
- **Rounding**: `calcEarnings` rounds to 2dp via `Math.round(hours * rate * 100) / 100`

**Fix implemented:** Sessions table now shows a tooltip with the earnings breakdown (e.g., "2.5 hrs × 200/hr = 500 EGP"). The "Rate" column was removed and merged into the "Earnings" column as a tooltip.

- [ ] Check a specific wrong session's `rate_type` and `rate_applied`
- [ ] Verify the tooltip shows correct calculation

### 3b. Deleted calendar events reappearing — PARTIALLY FIXED

ICS import only **adds** events — no deletion sync.

**Fix implemented:** Added EXDATE and STATUS:CANCELLED handling in `icsImportService.js`:
- EXDATE entries are now collected and excluded from RRULE expansion
- Single events with `STATUS:CANCELLED` are skipped
- Cancelled RECURRENCE-ID override instances are excluded and blocked from RRULE expansion

- [ ] Test with real ICS file that has EXDATE entries
- [ ] Test with real ICS file that has cancelled events
- [ ] Decide: add a "sync deletions" feature for future

---

## 4. Monthly View Column Labels ✅ FIXED

Renamed columns for clarity:
- "Expected" → "Earned"
- "Cum. earned" → "Total earned"
- "Cum. paid" → "Total paid"
- "Running balance" → "Owed to you" (positive = owed to you)

---

## 5. Dropdown Dark Mode ✅ FIXED

**Fix implemented:**
- Added `select option` styling in `index.css` using CSS variables for proper dark mode support
- Changed all `<select>` elements from `bg-transparent` to `bg-surface-elevated` with `dark:text-txt-primary`
- Applied to: Sessions (3 selects), Clients (1 select), Sync (1 select), Onboarding (3 selects)

---

## 6. Additional Checks

### 6a. ICS RRULE edge cases
- [ ] All-day events (`datetype === 'date'`) correctly skipped
- [ ] Zero-duration events skipped
- [ ] Multi-day events: `durationHours` from `end - start` correct
- [ ] Events > 24hrs (> 168hrs filtered)

### 6b. Session data integrity
- [ ] March 26 session → "April 2025 Salary" when cycle starts on 25th
- [ ] Edge date cycle boundaries (1st day, last day)
- [ ] `flagged = 1` + `category = 'Uncategorized'` appear in filtered view

### 6c. Payment assignment
- [ ] `cumulativePaid` correctly accumulates (payments with date ≤ cycleEnd)
- [ ] Payment on exact cycleEnd date included
- [ ] Payments with no `client_id` attributed correctly

### 6d. Dashboard charts
- [ ] Bar chart: `expectedEarnings` per cycle
- [ ] Line chart: cumulative earned vs cumulative paid
- [ ] X-axis: "April 2025 Salary" format
- [ ] Data updates after adding session

### 6e. Pro gate
- [ ] Free user: blocked from 2nd client
- [ ] Manual pro (null status): full access
- [ ] Cancelled sub in grace: still pro

### 6f. Fake ICS test file
Create `.ics` with:
- [ ] 50-100 events across 3 months
- [ ] Recurring events (daily, weekly, monthly)
- [ ] RECURRENCE-ID overrides
- [ ] EXDATE exclusions
- [ ] Various durations (1hr, 1.5hr, 2hr, 2.5hr)
- [ ] Cancelled event (`STATUS:CANCELLED`)
- [ ] All-day events (should be skipped)
- [ ] Test: import → verify count → re-import → no dupes → add payments → verify monthly

---

## Summary

| # | Issue | Type | Priority |
|---|---|---|---|
| 1 | ICS re-import duplication | Verification | HIGH |
| 2 | Notification bell totalOwed double-counts | Bug | HIGH |
| 3 | Wrong earnings / deleted events in ICS | Bug | HIGH |
| 4 | Monthly view column labeling | Enhancement | MEDIUM |
| 5 | Dropdown dark mode styling | Bug | MEDIUM |
| 6 | Edge cases & test data | Verification | MEDIUM-HIGH |