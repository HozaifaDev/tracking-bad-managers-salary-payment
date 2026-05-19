# Smart ICS Import

## Problem

Users had calendar events (shifts, lectures, sessions) in ICS format and needed to import them as tracked sessions. The naive approach — bulk import every event as a session — was insufficient because:

1. Different event titles meant different work types with different pay rates
2. Some events shouldn't be imported at all
3. Recurring events (RRULE) needed to be expanded into individual instances
4. Users needed to see what they were importing before committing

## Approach

### Three-Phase Wizard: Upload → Map → Confirm

**Phase 1 — Upload**
- User uploads an `.ics` file or pastes raw ICS text
- Backend parses all events, expands RRULE instances, filters by date range
- Returns summary: unique titles, date range, total event count

**Phase 2 — Map**
- Backend groups events by title using `detectTitleGroups()`
- Each group gets suggested mappings based on keyword matching against existing work types (`matchWorkTypeByKeyword()`)
- User decides: assign a work type, create a new one, or skip
- "Skip all unmatched" lets users bypass remaining unresolved titles

**Phase 3 — Confirm**
- Backend receives the final mapping and list of skipped titles
- `applyRawEventsToDatabase()` processes events, applying mappings and skipping flagged titles
- Skipped events get `category: 'Uncategorized'` and `flagged: '1'`
- Returns count of imported, skipped, and total events

### Key Implementation Details

**RRULE Expansion** — the critical bug we caught:
```js
// BEFORE (broken): skipped ALL recurring events
if (ev.rrule) continue;

// AFTER (correct): expand them into instances
if (ev.rrule) {
  const instances = ev.rrule.between(rangeStart, rangeEnd, true);
  // dedup via override key tracking
}
```
Node-ical v0.20.1 provides `ev.rrule.between(start, end, inc)` for bounded expansion. Some RRULE strings can throw, so we wrap in try/catch.

**Keyword Matching** — `matchWorkTypeByKeyword()`:
- Normalizes both the event title and work type names to lowercase
- Checks if any work type keyword appears as a substring in the title
- Returns the first match or `null` for manual resolution

**Import Mapping Persistence** — when a user maps a title to a work type during import, it's saved to the client's `config.work_types` array for future imports. This means subsequent imports auto-resolve known titles.

## Files

| File | Role |
|---|---|
| `backend/services/icsImportService.js` | Parse ICS, extract unique titles, detect title groups |
| `backend/services/calculatorService.js` | `matchWorkTypeByKeyword()`, `buildSessionRow()` with importMapping |
| `backend/services/sessionSyncLogic.js` | `applyRawEventsToDatabase()` with mappings and skipped titles |
| `backend/routes/import.js` | `/ics`, `/ics/preview`, `/ics/confirm` endpoints |
| `frontend/src/pages/Sync.jsx` | SmartImportWizard component (3-phase UI) |
| `frontend/src/lib/api.js` | `previewIcsFile()`, `previewIcsPaste()`, `confirmIcsImport()` |

## Edge Cases Handled

- Empty date range filter (empty strings treated as falsy, not truthy)
- RRULE events with no exceptions (fully recurring series)
- RRULE events with override dates (modified/cancelled individual instances)
- Duplicate events from overlapping recurring rules
- Events outside the selected date range
- Sub-category delimiters (configurable per import, default ` - `)
- `DELETE /api/sessions/uncategorized` for bulk cleanup of flagged sessions