# Roadmap — Hours & Salary Tracker

> A payment accountability tool for instructors and freelancers. Track sessions, calculate what you're owed, log payments, and generate evidence when managers don't pay on time.

---

## Contributors

- [HozaifaDev](https://github.com/HozaifaDev) — founder & original author
- [YoussefBastawisy](https://github.com/YoussefBastawisy) — contributor

---

## Phase 1 — Multi-User Foundation ✅

> Goal: make the app usable by anyone, not just as a local personal tool.

| Task | Status |
|---|---|
| JWT authentication (register / login / me) | ✅ Done |
| `requireAuth` middleware — all routes protected | ✅ Done |
| Unified async DB adapter (SQLite local + PostgreSQL production) | ✅ Done |
| Migrations rewritten — `users` table + `user_id` isolation on all data | ✅ Done |
| All routes and services converted to async | ✅ Done |
| Login / Register pages with redirect on 401 | ✅ Done |
| Logout button in Sidebar | ✅ Done |
| `render.yaml` — one-click deploy to Render.com with managed PostgreSQL | ✅ Done |
| `.env.example` — all variables documented | ✅ Done |

---

## Phase 2 — Make It Valuable 🚧

> Goal: deliver real accountability features that justify switching from a spreadsheet.

### 2a — Payment Accountability
| Task | Status |
|---|---|
| Overdue payment alerts (email via Resend / Nodemailer) | 🔲 Todo |
| WhatsApp / Telegram reminder bot integration | 🔲 Todo |
| Configurable reminder schedule (e.g. 3 days after cycle end) | 🔲 Todo |
| Public payment status page (shareable link for the manager) | 🔲 Todo |

### 2b — Documents & Evidence
| Task | Status |
|---|---|
| PDF invoice generator (per salary month) | 🔲 Todo |
| Payment demand letter PDF (professional dispute document) | 🔲 Todo |
| Evidence export bundle (sessions + payments + balance as a single PDF) | 🔲 Todo |

### 2c — Multi-Client Support
| Task | Status |
|---|---|
| Multiple employers / clients per user | 🔲 Todo |
| Per-client earning rules (rates, currency, billing cycle) | 🔲 Todo |
| Per-client payment tracking and balance | 🔲 Todo |

### 2d — UX Improvements
| Task | Status |
|---|---|
| PWA / mobile-friendly layout | 🔲 Todo |
| Dark/light theme toggle | 🔲 Todo |
| Notification bell for overdue balance | 🔲 Todo |
| Onboarding wizard (first-time setup guide) | 🔲 Todo |

---

## Phase 3 — Monetization 💰

> Goal: turn the tool into a sustainable SaaS product.

### Pricing tiers
| Tier | Features | Price |
|---|---|---|
| **Free** | 1 client, basic tracking, Excel export | $0 |
| **Pro** | Unlimited clients, PDF invoices, payment alerts, WhatsApp reminders | ~$9/mo |
| **Team** | Manager view, multiple instructors under one organization | ~$29/mo |

### Tasks
| Task | Status |
|---|---|
| Stripe integration (subscription billing) | 🔲 Todo |
| Feature gating by plan (free vs pro vs team) | 🔲 Todo |
| Team / organization model (many instructors, one manager view) | 🔲 Todo |
| Usage analytics dashboard (admin) | 🔲 Todo |
| Landing page & marketing site | 🔲 Todo |

---

## Phase 4 — Growth & Expansion 🌍

> Longer-term ideas once the core product is solid.

| Idea | Notes |
|---|---|
| Calendar-agnostic sync (Outlook, Apple Calendar, manual ICS) | Remove Google-only dependency |
| i18n — multiple currencies and languages | Open to global markets |
| Mobile app (React Native) | Instructors are often on phones |
| API for integrations (Zapier, Make) | Let power users automate |
| Dispute escalation workflow | Auto-generate formal complaint letter |

---

## Tech Stack

| Layer | Current | Target (production) |
|---|---|---|
| Backend | Node.js 22+, Express, SQLite | Node.js 22+, Express, PostgreSQL (Render) |
| Frontend | React 18, Vite, Tailwind, TanStack Query | Same + PWA |
| Auth | JWT (bcryptjs + jsonwebtoken) | Same |
| Deploy | Local | Render.com (backend + DB) + Vercel (frontend) |

---

## How to Contribute

1. Fork the repo and clone it
2. Create a branch from `main`: `git checkout -b feature/your-feature`
3. Check the roadmap above and pick an unclaimed task
4. Open a PR and reference the task (e.g. "Implements Phase 2a — overdue alerts")
5. Keep PRs focused — one task per PR

### Local setup

```bash
# Backend
cd backend
cp ../.env.example ../.env   # fill in your values
npm install
npm run dev                  # starts on :3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                  # starts on :3000
```

No DATABASE_URL → SQLite is used automatically. No Google credentials → Calendar sync is disabled; use manual entry or ICS import instead.
