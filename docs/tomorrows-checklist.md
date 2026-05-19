# Tomorrow's Checklist

> Things to verify, fix, or build — organized by priority.

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

## 2. Notification Bell Shows Wrong Owed Number [BUG — HIGH]

**Symptom:** Notification bell shows inflated total owed number.

**Root cause:** `notifications.js:42` sums all overdue `runningBalance` values:

```js
totalOwed: overdueCycles.reduce((sum, m) => sum + m.runningBalance, 0),
```

But `runningBalance` is **already cumulative**. Summing them double-counts earlier cycles.

| Cycle | cumEarned | cumPaid | runningBalance |
|-------|-----------|---------|----------------|
| 1     | 1000      | 0       | 1000           |
| 2     | 2000      | 0       | 2000           |

**Current:** 1000 + 2000 = 3000 (wrong) | **Correct:** 2000 (latest overdue cycle)

**Fix:** `backend/routes/notifications.js` line 42 — use last overdue cycle's runningBalance:

```js
totalOwed: overdueCycles.length > 0
  ? overdueCycles[overdueCycles.length - 1].runningBalance
  : 0,
```

- [ ] Fix `totalOwed` in `notifications.js`
- [ ] Decide: per-cycle show `runningBalance` or `expectedEarnings`?
- [ ] Re-test notification bell

---

## 3. Earnings Calculation & Deleted Events [BUG — HIGH]

### 3a. Wrong earnings (hours × rate ≠ shown earnings)

Possible causes:
- **Rate type mismatch**: `per_session` uses flat rate, not hourly. 2.5hrs × 200 for `per_session` = 200 (flat), not 500
- **Rounding**: `calcEarnings` rounds to 2dp via `Math.round(hours * rate * 100) / 100`
- Should show a calculation breakdown: "2.5 hrs × 200/hr = 500 EGP"

- [ ] Check a specific wrong session's `rate_type` and `rate_applied`
- [ ] Add rate_type display to Sessions table
- [ ] Add calc breakdown in edit/add dialog

### 3b. Deleted calendar events reappearing

ICS import only **adds** events — no deletion sync. Old sessions stay in DB even if deleted from calendar.

- [ ] Verify: does parser handle `EXDATE`? (excluded dates from recurring events)
- [ ] Verify: does parser handle `STATUS:CANCELLED`?
- [ ] Decide: add a "sync deletions" feature or manual cleanup tool

---

## 4. Monthly View Column Labels [ENHANCEMENT — MEDIUM]

Current columns: Salary month | Cycle period | Payment due | Sessions | Hours | **Expected** | Cum. earned | Cum. paid | Running balance

"Expected" is confusing — it's **actual** calculated earnings, not a projection.

- [ ] Rename "Expected" → "Earned"
- [ ] Rename "Cum. earned" → "Total earned" (add tooltip: cumulative across all cycles)
- [ ] Rename "Cum. paid" → "Total paid"
- [ ] Rename "Running balance" → "Balance owed" (positive = owed to you)

---

## 5. Dropdown Dark Mode [BUG — MEDIUM]

Native `<select>` elements have `bg-transparent` — in dark mode, `<option>` dropdowns render with OS-level light backgrounds. Text becomes invisible.

**Quick fix** — add to `index.css`:
```css
select option {
  background-color: hsl(var(--surface-elevated));
  color: hsl(var(--text-primary));
}
```

**Proper fix:** Replace native `<select>` with Radix/shadcn `Select` components.

Affected pages: Sessions (filter, add, edit), Clients (rate type), Sync (mapping), Onboarding (currency)

- [ ] Add dark mode option styling
- [ ] Consider migrating to Radix Select
- [ ] Verify both themes

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