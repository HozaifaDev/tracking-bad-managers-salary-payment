# Reviews

Design and code reviews — what we considered, what we chose, and why.

---

## Review: ICS Import Flow — Bulk vs. Wizard

**Date:** May 2026

**Options considered:**

1. **Bulk import** — Parse ICS, auto-match everything, import silently. User sees results after the fact.
2. **Wizard with mapping** — Show preview, let user map titles to work types, then confirm. Interactive resolution of unmatched events.
3. **AI-assisted mapping** — Use LLM to auto-categorize event titles into work types.

**Decision:** Option 2 — Wizard with mapping.

**Rationale:**
- Bulk import is silent and error-prone. Wrong mappings = wrong pay calculations. No undo.
- AI-assisted mapping adds latency and a dependency for uncertain gains. The title set is small (usually 3–8 unique titles per client).
- The wizard gives users full control. Auto-suggestions via `matchWorkTypeByKeyword()` handle the easy cases. Manual resolution handles the rest. The "skip all unmatched" escape hatch means users never feel trapped.

**What we'd do differently:** The initial version had no "skip all unmatched" button. Users had to resolve each title one by one. After testing with real data (30+ unique titles from a university calendar), we added bulk skip.

---

## Review: Payment Due Window — Per-Client vs. Global

**Date:** May 2026

**Options considered:**

1. **Global setting** — One payment due window for all clients.
2. **Per-client setting** — Each client has its own `payment_due_start_day` and `payment_due_end_day`.

**Decision:** Option 2 — Per-client.

**Rationale:**
- Different employers have different payment deadlines. A university might pay on the 1st–5th. A private client might pay on the 10th–15th.
- Global settings can't represent this difference. Users with multiple clients would see wrong due dates.
- Database cost is minimal (two extra INTEGER columns with defaults).
- Frontend cost is minimal (two extra number inputs in the client editor).

**Default values:** 1 and 5. This covers the most common pattern where salary is due within the first 5 days of the following month.

---

## Review: Salary Label — "April 2025" vs. "April 2025 Salary"

**Date:** May 2026

**Options considered:**

1. **Plain month** — "April 2025"
2. **Month + type suffix** — "April 2025 Salary"

**Decision:** Option 2 — Month + type suffix.

**Rationale:**
- "April 2025" is ambiguous. Is it the month of April? The April salary? A deadline?
- "April 2025 Salary" is unambiguous and matches how people talk about their pay.
- Adding "Salary" costs nothing — it's a string concatenation. Removing ambiguity costs even less.
- If we ever support non-salary cycle types (e.g., "April 2025 Retainer"), the architecture supports it.

---

## Review: Uncategorized Sessions — Soft Delete vs. Hard Delete vs. Flag

**Date:** May 2026

**Options considered:**

1. **Don't import unmatched** — Skip events with no mapping, leave them out of the database entirely.
2. **Import all, flag unmatched** — Import everything, mark unmatched events with `category: 'Uncategorized'` and `flagged: '1'`.
3. **Import to staging table** — Put unmatched events in a separate staging table, require explicit promotion.

**Decision:** Option 2 — Import all, flag unmatched.

**Rationale:**
- Option 1 means users lose visibility into what they skipped. If they skip something they needed, there's no record.
- Option 3 is over-engineered for the current scale. A separate staging table adds JOINs and complexity.
- Option 2 keeps everything in one table. The `flagged` column is a simple boolean filter. The `UncategorizedBanner` on the Sync page shows how many unmatched events exist. Bulk delete is one API call.
- The "skip all unmatched" button on the mapping page sets everything to uncategorized, and the user can clean up later from the UI.

---

## Review: Pro Plan Gate — Status Check

**Date:** May 2026

**Issue:** User `hozaifa@admin.com` was manually set to pro plan but couldn't access pro features.

**Original check:**
```js
plan === 'pro' && ['active', 'cancelled'].includes(status)
```

**Problem:** Manually-set pro users have `ls_subscription_status = null`. The `.includes(null)` returns `false`.

**Options considered:**

1. **Set a default status** — When manually setting pro, also set `ls_subscription_status` to `'active'`.
2. **Treat null status as active** — Allow pro users with no subscription status.
3. **Check both** — `['active', 'cancelled'].includes(status) || status === null`

**Decision:** Option 2 — Treat null/undefined status as active for pro-plan users.

**Rationale:**
- If `plan === 'pro'`, the user has pro access. The subscription status is a billing concern, not an access concern.
- Option 1 adds a side effect to manual plan changes.
- Option 2 is the simplest and most correct: if you're on the pro plan, you have pro access, regardless of billing status.
- Cancelled subscriptions still get pro access until expiration (separate concern handled by LemonSqueezy webhooks).

**Location:** `backend/routes/billing.js` line 20