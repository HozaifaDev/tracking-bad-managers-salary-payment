# Hours & Salary Tracker (full stack)

A **local-only** web app for one instructor: pull sessions from **Google Calendar**, compute **EGP** earnings from editable rules, log **payments** in **SQLite**, and view balances, charts, and **Excel** export in the browser at **http://localhost:3000**.

- **Backend:** Node.js 22.5+, Express, built-in **`node:sqlite`**, `googleapis`, `exceljs`, `date-fns`, `dotenv`
- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, React Router, Recharts, Sonner
- **Data:** `backend/tracker.db` (auto-created), root `config.json` (human-editable)

A legacy **Python CLI** (`main.py`, `src/`) may still exist in this folder; the web app does not use it.

---

## What it does (plain English)

1. You name calendar events in a consistent way (Group A/B, Private Course, Diploma, etc.).
2. You **sync** a date range from Google Calendar; each event becomes one **session** row (duplicates skipped by Google event id).
3. The app calculates **earnings** per session from `config.json`.
4. You record **payments** when money hits your account.
5. The **dashboard** shows total earned, total paid, and **what you’re still owed**.
6. You can **export** the same logic to an Excel workbook.

---

## Prerequisites

- **Node.js 22.5+** (needed for built-in `node:sqlite`; use **22 LTS** if you hit issues on Node 24)
- **npm**
- Google account and a **Google Cloud** project with **Calendar API** enabled
- **OAuth client** (Desktop app) → download JSON as `backend/credentials.json`

---

## Installation

From the `hours-tracker` directory:

1. **Clean install** (recommended if you previously had `better-sqlite3` or EPERM errors):

   ```bash
   rmdir /s /q node_modules backend\node_modules frontend\node_modules 2>nul
   del package-lock.json 2>nul
   npm install
   ```

2. Or a normal install:

   ```bash
   npm install
   ```

The backend uses **Node’s built-in SQLite** (`node:sqlite`) — **no Visual Studio / Windows SDK / node-gyp** required.

If install still hits **EPERM**, close Cursor/VS Code on that folder, pause OneDrive/antivirus scanning for the project path, or run the terminal **as Administrator** once.

Install all workspaces explicitly:

```bash
npm run install:all
```

---

## Configuration

### `.env` (repo root)

| Variable | Meaning |
|----------|---------|
| `PORT` | API port (default **3001**) |
| `DB_PATH` | SQLite file, relative to **backend/** (default `./tracker.db`) |
| `CONFIG_PATH` | Path to `config.json`, relative to **backend/** (default `../config.json`) |
| `NODE_ENV` | `development` shows error stacks in JSON responses |

### `config.json` (root)

| Section | Meaning |
|---------|---------|
| `timezone` | IANA zone for calendar parsing (e.g. `Africa/Cairo`) |
| `work_cycle_start_day` | Cycle starts this day each month (default **25**) |
| `currency` | Display label (e.g. `EGP`) |
| `groups` | Named groups → `rate_per_hour`, `platform`, `color` |
| `private_courses` | `default_split_instructor`, `default_hourly_rate`, `overrides` for fixed deals |
| `diplomas` | Track name → `{ color, milestones: { MilestoneName: payoutEGP } }` |

You can edit in **Settings** in the UI or by hand; the API re-reads the file on each request.

---

## Google Calendar setup

1. [Google Cloud Console](https://console.cloud.google.com/) → your project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External (or Internal) → add yourself as test user if needed.
4. **Credentials → Create credentials → OAuth client ID → Desktop app** → download JSON.
5. Save as **`hours-tracker/backend/credentials.json`** (never commit it).

### First-time auth (terminal)

Google OAuth needs a one-time browser step:

```bash
cd backend
npm run auth
```

Open the printed URL, approve, paste the **code** into the terminal. This creates **`backend/token.json`** (gitignored).

Then start the app and use **Sync** in the UI.

---

## Calendar event naming

| Title contains | Category | Notes |
|----------------|----------|--------|
| `Group A` | Group A | Hourly rate from config |
| `Group B` | Group B | Hourly rate from config |
| `Private Course:` | Private Course | Text after `:` is the course key; add ` - COMPLETE` or ` - Done` for fixed payout |
| `Diploma:` | Diploma | e.g. `Diploma: Data Analysis - Excel`; milestone payout on `… - COMPLETE` / `Done` |
| Anything else | Uncategorized | **Flagged**, 0 EGP |

**Examples**

- `Group A - Evening`
- `Private Course: Python Basics`
- `Private Course: SQL - COMPLETE` (fixed amount from overrides)
- `Diploma: Data Analysis - Excel - COMPLETE`

All-day events are **not** imported.

---

## Billing cycle (25th rule)

Default: each **salary month** runs from the **25th** of the previous calendar month through the **24th** of the named month (configurable via `work_cycle_start_day`).

Example: **Nov 25 – Dec 24** → salary month **December 2024**.

---

## Run the app

```bash
npm run dev
```

- **Frontend:** http://localhost:3000  
- **API:** http://localhost:3001  
- Vite proxies `/api` → the backend.

### Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Backend (nodemon) + frontend (Vite) together |
| `cd backend && npm run auth` | Google OAuth token setup |
| `cd backend && npm start` | API only |

---

## Using the UI

| Page | Purpose |
|------|---------|
| **Dashboard** | Totals, bar chart (expected per month), line chart (cumulative earned vs paid), recent sessions |
| **Sessions** | Filter, sort, paginate, edit/delete rows |
| **Payments** | Add/edit/delete payments; running total column |
| **Monthly** | Per salary month breakdown + **Download Excel** |
| **Sync** | Date range + **Sync now**; auth status; last 10 sync logs |
| **Settings** | Structured editor for `config.json` |

---

## Payments

- Log **date received** and **amount**; notes are free text.
- Payments are **not** auto-mapped to salary months; monthly view uses **cumulative paid through each cycle end** for comparison.

---

## Excel export

**Monthly** page → **Download Excel report**, or `GET /api/reports/export?from=&to=` (optional session date filter).

Sheets: **Summary**, **Monthly Breakdown**, **Session Log**, **Payment Log**.

---

## API summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/calendar/sync` | Body `{ from, to }` — fetch & insert sessions |
| GET | `/api/calendar/status` | `hasToken`, `hasCredentials` |
| GET | `/api/sessions` | Query: `page`, `from`, `to`, `category`, `salaryMonth`, `flagged`, `search`, `sortBy`, `sortDir` |
| PUT | `/api/sessions/:id` | Manual overrides (`earnings`, `note`, `flagged`, `category`, `rateApplied`) |
| DELETE | `/api/sessions/:id` | Remove session |
| GET/POST/PUT/DELETE | `/api/payments` | Payment CRUD |
| GET | `/api/reports/summary` | Dashboard totals |
| GET | `/api/reports/monthly` | Monthly breakdown array |
| GET | `/api/reports/export` | Excel file stream |
| GET/PUT | `/api/config` | Read/write `config.json` |
| GET | `/api/sync/log` | Last 10 sync rows |

---

## Offline behavior

After data is in SQLite, the app works **without internet**. Only **Sync** and **Google auth** need a connection.

Re-sync **never deletes** sessions; existing `calendar_event_id` rows are skipped.

---

## Project layout

```
hours-tracker/
├── package.json
├── config.json
├── .env
├── backend/
│   ├── server.js
│   ├── db/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── scripts/googleAuth.js
│   ├── credentials.json   ← you add
│   └── token.json         ← generated
├── frontend/
│   └── src/
└── tracker.db             ← created under backend/ by default
```

---

## Troubleshooting

- **`credentials.json not found`** — place Desktop OAuth JSON in `backend/`.
- **`Google Calendar not connected`** — run `cd backend && npm run auth`.
- **`node:sqlite is not available`** — upgrade to **Node 22.5+** (e.g. install [Node 22 LTS](https://nodejs.org/) or use `nvm install 22`).
- **`Cannot find module 'readable-stream'` / broken `node_modules`** — delete all `node_modules` folders and `package-lock.json`, then `npm install` again.

---

## License

Personal use; adapt freely for your own teaching workflow.
