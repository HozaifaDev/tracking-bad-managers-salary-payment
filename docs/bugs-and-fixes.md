# Bugs & Fixes

Every bug we encountered, its root cause, and how we fixed it.

---

## 1. RRULE Events Silently Skipped

**Symptom:** A user importing an ICS file with recurring events saw only 1 event instead of 465. All RRULE events were missing.

**Root Cause:** In `icsImportService.js`, the event processing loop had:
```js
if (ev.rrule) continue; // skip recurring events entirely
```
This was likely leftover from an early prototype that didn't handle recurrence. It caused every recurring event to be thrown away.

**Fix:** Replaced the skip with proper RRULE expansion:
```js
if (ev.rrule) {
  try {
    const instances = ev.rrule.between(rangeStart, rangeEnd, true);
    for (const dt of instances) {
      // create individual event, dedup with override key tracking
    }
  } catch (err) {
    console.warn('Failed to expand RRULE:', err.message);
  }
}
```

**Verification:** Import count went from 1 event to 465 events.

**Date:** May 2026

---

## 2. ICS Date Range Filter Too Broad

**Symptom:** preview endpoint returned events outside the user-specified date range.

**Root Cause:** The date range filter checked `if (from || to)` — empty strings `""` are truthy in JavaScript, so when the frontend sent empty values, the filter activated with invalid bounds.

**Fix:** Changed to explicit truthiness check:
```js
const rangeStart = from ? new Date(from) : undefined;
const rangeEnd = to ? new Date(to) : undefined;
// Only filter when dates are actually provided
```

Also added a `sanitizeRange()` helper in the import route to normalize inputs.

**Date:** May 2026

---

## 3. Pro Plan Check Broken for Manually-Set Users

**Symptom:** User `hozaifa@admin.com` with manually-assigned pro plan could not access pro features. Gate always returned false.

**Root Cause:** The `isPro` check was:
```js
plan === 'pro' && ['active', 'cancelled'].includes(status)
```
For manually-set pro users, `ls_subscription_status` is `null` (they have no LemonSqueezy subscription). The status check `['active', 'cancelled'].includes(null)` returned `false`.

**Fix:** Allow null/undefined status for pro-plan users:
```js
plan === 'pro' && (!status || ['active', 'cancelled'].includes(status))
```

**Location:** `backend/routes/billing.js` line 20

**Date:** May 2026

---

## 4. SQLite ALTER TABLE Not Idempotent

**Symptom:** Server crash on restart after migration columns already existed.

**Root Cause:** SQLite `ALTER TABLE ADD COLUMN` throws `duplicate column name` if the column already exists. Unlike PostgreSQL, SQLite doesn't support `IF NOT EXISTS` on `ALTER TABLE`.

**Fix:** Wrapped each migration in try/catch:
```js
try { await db.exec('ALTER TABLE clients ADD COLUMN payment_due_start_day INTEGER DEFAULT 1'); } catch {}
try { await db.exec('ALTER TABLE clients ADD COLUMN payment_due_end_day INTEGER DEFAULT 5'); } catch {}
```

**Date:** May 2026