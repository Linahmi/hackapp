# ProcureTrace by ChainIQ — Technical Documentation

> Autonomous AI sourcing agent — built at HackApp 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Getting Started](#3-getting-started)
4. [Authentication](#4-authentication)
5. [API Reference](#5-api-reference)
6. [Data Layer](#6-data-layer)
7. [Frontend Pages](#7-frontend-pages)
8. [Pipeline Deep Dive](#8-pipeline-deep-dive)
9. [Roles & Permissions](#9-roles--permissions)
10. [Approval Workflow](#10-approval-workflow)
11. [Notifications & Reminders](#11-notifications--reminders)
12. [Lib Modules](#12-lib-modules)

---

## 1. Overview

ProcureTrace processes free-text procurement requests end-to-end:

- Parses unstructured text into structured procurement data
- Validates against business policies (approval tiers, geography, category rules)
- Scores and ranks eligible suppliers (price, lead time, quality, risk, ESG)
- Generates an AI decision with justification
- Routes requests for human approval when required
- Maintains a full audit trail of every action

**Stack:** Next.js 16 · React 19 · Tailwind CSS 4 · Azure OpenAI · Recharts

---

## 2. Architecture

```
Client (Browser)
    │
    ├── POST /api/process-stream  ← SSE streaming pipeline (core)
    ├── POST /api/auth/login      ← session cookie
    ├── GET  /api/approvals       ← manager queue
    └── POST /api/requests/[id]/approve|reject
            │
            ▼
    lib/ (business logic)
    ├── intakeAgent.js        ← Azure OpenAI: text → structured request
    ├── policyEngine.js       ← approval tiers, restrictions, geography
    ├── supplierScorer.js     ← weighted scoring algorithm
    ├── decisionEngine.js     ← Azure OpenAI: final decision + justification
    ├── escalationRouter.js   ← 6-level escalation hierarchy
    ├── auditLogger.js        ← every event logged to audit_log.json
    ├── notificationService.js← email (MOCK / Resend)
    ├── reminderService.js    ← in-memory approval reminders
    └── session.js            ← HMAC-SHA256 cookie auth
            │
            ▼
    data/ (flat-file persistence)
    ├── suppliers.csv          ← supplier master
    ├── pricing.csv            ← unit prices by tier/region
    ├── policies.json          ← approval rules
    ├── historical_awards.csv  ← past contracts
    ├── audit_log.json         ← audit trail (appended)
    ├── approvals.json         ← approval decisions
    ├── drafts.json            ← saved drafts
    ├── request_owners.json    ← requester → request mapping
    ├── request_counter.json   ← R-XXXX counter + history
    └── users.json             ← registered accounts
```

---

## 3. Getting Started

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Run on port 3001
npm run dev:local

# Expose on local network (for demo)
npm run dev:share

# Build for production
npm run build && npm start

# Run tests
npm test
```

### Environment Variables (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | HMAC secret for session cookies — change before deploying |
| `AZURE_OPENAI_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | Deployment model name |
| `EXA_API_KEY` | Optional | Exa API key for supplier intelligence |
| `RESEND_API_KEY` | Optional | Resend key for real emails (mock mode if absent) |
| `NOTIFICATION_FROM_EMAIL` | Optional | Sender address (default: `noreply@procuretrace.app`) |
| `REMINDER_FIRST_MS` | Optional | First reminder delay in ms (default: 24h) |
| `REMINDER_REPEAT_MS` | Optional | Repeat reminder interval in ms (default: 48h) |

---

## 4. Authentication

### How it works

- **Mechanism:** HMAC-SHA256 signed cookie (`pt_session`)
- **TTL:** 8 hours
- **No external dependency** — uses Node.js built-in `crypto`
- **Session payload:** `{ id, email, name, role, title, exp }`

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| `alice@company.com` | `alice123` | manager (Procurement Manager) |
| `bob@company.com` | `bob123` | manager (Head of Category) |
| `charlie@company.com` | `charlie123` | manager (Head of Strategic Sourcing) |
| `requester@company.com` | `req123` | requester |
| `admin@company.com` | `admin123` | admin |

### Create Account

Anyone can self-register as a **requester** at `/login` → "Create account" tab.
Manager and admin accounts can only be created by an admin via `POST /api/auth/register` with a valid admin session cookie.

### Session Expiry

When the 8h cookie expires, any API call returns `401`. The global fetch interceptor in `AuthContext` detects this and clears the user state, prompting re-login.

---

## 5. API Reference

### Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | — | `{ email, password }` → sets cookie |
| POST | `/api/auth/logout` | — | Clears session cookie |
| GET | `/api/auth/me` | Any | Returns current user or 401 |
| POST | `/api/auth/register` | — (requester) / admin (other roles) | `{ name, email, password, role? }` → auto-login |

### Pipeline

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/process-stream` | — | SSE streaming pipeline. Body: `{ text, request_id? }` |
| POST | `/api/process` | — | Non-streaming version |
| POST | `/api/intake` | — | Parse only (no scoring/decision) |
| POST | `/api/live-validate` | — | Real-time field validation while typing |

### Requests

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/requests` | — | List all requests (from `requests.json`) |
| GET | `/api/requests/[id]` | — | Get single request |
| GET | `/api/requests/mine` | Any | List requests owned by current user |
| GET | `/api/requests/[id]/status` | Any (owner/manager/admin) | Current status + event timeline |
| POST | `/api/requests/[id]/claim` | Any | Link request to current user after pipeline completes |
| POST | `/api/requests/[id]/approve` | manager, admin | Approve + optional comment |
| POST | `/api/requests/[id]/reject` | manager, admin | Reject + required comment |

### Approvals

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/approvals` | manager, admin | Pending queue scoped to logged-in manager's title |

### Drafts

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/drafts` | Any | List my drafts |
| POST | `/api/drafts` | Any | Create draft. Body: `{ text, title? }` |
| GET | `/api/drafts/[id]` | Owner / admin | Get draft |
| PUT | `/api/drafts/[id]` | Owner | Update text/title |
| DELETE | `/api/drafts/[id]` | Owner | Delete (only if not yet submitted) |
| POST | `/api/drafts/[id]/submit` | Owner | Mark as submitted, returns `{ text }` |

### Analytics

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/dashboard` | — | KPIs, charts data, demand velocity |
| GET | `/api/stats` | — | Request counter + auto-approval % |
| POST | `/api/supplier-intel` | — | Exa-powered supplier discovery |
| GET | `/api/demo` | — | Demo request fixtures |

---

### Request / Response Examples

**Login**
```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@company.com","password":"alice123"}'
# → { "user": { "id": "u001", "email": "alice@company.com", "name": "Alice Martin", "role": "manager", "title": "Procurement Manager" } }
```

**Get approval queue (as Alice)**
```bash
curl -b cookies.txt http://localhost:3000/api/approvals
# → { "approver": "Alice Martin", "total": 3, "items": [...] }
```

**Approve a request**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/requests/R-0093/approve \
  -H "Content-Type: application/json" \
  -d '{"comment":"Supplier verified, proceeding."}'
# → { "ok": true, "requestId": "R-0093", "status": "APPROVED" }
```

**Poll request status**
```bash
curl -b cookies.txt http://localhost:3000/api/requests/R-0093/status
# → { "approval_status": "APPROVED", "is_final": true, "timeline": [...] }
```

---

## 6. Data Layer

All persistence uses flat JSON/CSV files. Every store uses the same **safe-write pattern** (silent failure on read-only filesystems like Vercel).

### Static Reference Data

| File | Description |
|------|-------------|
| `data/suppliers.csv` | Supplier master: id, name, categories, quality/risk/ESG scores |
| `data/pricing.csv` | Unit prices and lead times by supplier, category, region, quantity band |
| `data/historical_awards.csv` | Past contract awards used for gap-filling and context |
| `data/requests.json` | Sample procurement requests for demo and testing |
| `data/policies.json` | Approval tiers (AT-001 to AT-005), restricted suppliers, category/geo rules |
| `data/categories.csv` | Category taxonomy (L1 → L2) |

### Dynamic Stores

| File | Written by | Contains |
|------|-----------|---------|
| `data/audit_log.json` | `auditLogger.js` | All pipeline + workflow events |
| `data/approvals.json` | `approvalStore.js` | Approve/reject decisions |
| `data/drafts.json` | `draftStore.js` | Saved request drafts |
| `data/request_owners.json` | `requestOwnerStore.js` | Requester → request mapping |
| `data/request_counter.json` | `requestCounter.js` | R-XXXX counter + request history |
| `data/users.json` | `userStore.js` | Self-registered user accounts |

---

## 7. Frontend Pages

| Route | Visible to | Description |
|-------|-----------|-------------|
| `/` | All | Client portal — free-text request input, scenario cards, live validation |
| `/login` | Unauthenticated | Sign in + Create account (tabbed) |
| `/my-requests` | requester, admin | Own submitted requests with approval status badges |
| `/approvals` | manager, admin | Pending approval queue with approve/reject modal |
| `/analysis` | All | Full pipeline result: suppliers, decision, audit trail, escalations |
| `/dashboard` | All | KPI charts, demand velocity, request breakdown |
| `/supplier` | All | Supplier intelligence portal |

### Navigation Rules

- **Requester** sees: Client Portal · Supplier Portal · Analytics · **My Requests**
- **Manager** sees: Client Portal · Supplier Portal · Analytics · **Approvals**
- **Admin** sees: all links including both My Requests and Approvals
- **Unauthenticated** sees: Client Portal · Supplier Portal · Analytics · **Sign in** button

---

## 8. Pipeline Deep Dive

The main pipeline runs in `app/api/process-stream/route.js` as a **Server-Sent Events (SSE)** stream.

### Steps

```
Step 1 — Parsing (0% → 20%)
  Azure OpenAI parses free text → structured request object
  Gaps filled from historical_awards.csv (budget, quantities, delivery timeline)

Step 2 — Rules Check (20% → 40%)
  Validates completeness (quantity, budget, deadline, lead time feasibility)
  Checks approval tier (AT-001: <€5k auto, AT-005: >€500k requires CPO)
  Checks preferred supplier eligibility, category rules, geography constraints

Step 3 — Supplier Scoring (40% → 60%)
  Finds eligible suppliers from suppliers.csv + pricing.csv
  Scores on: price 30% · lead time 30% · quality 20% · risk 10% · ESG 10%
  Applies fuzzy logic overlay (Mamdani inference)
  Excludes restricted suppliers

Step 4 — Decision (60% → 85%)
  Routes escalations (up to 6 hierarchy levels)
  Azure OpenAI generates recommendation + justification
  Determines case type (READY_FOR_VALIDATION, FAILED_IMPOSSIBLE_DATE, etc.)

Step 5 — Logged (85% → 100%)
  Calculates confidence score (0–100)
  Determines: auto-approved (tier 1, no issues) or requires human approval
  Sends decision email to requester
  If approval needed: sends approval email + schedules reminder
  Logs everything to audit_log.json
```

### Case Types

| Case Type | Meaning |
|-----------|---------|
| `READY_FOR_VALIDATION` | All checks pass, supplier found |
| `FAILED_IMPOSSIBLE_DATE` | Delivery date in the past or lead time infeasible |
| `MORE_INFO_REQUIRED` | Request too vague to process |
| `PENDING_RESOLUTION` | Budget insufficient or conflicting data |
| `NO_SUPPLIER_AVAILABLE` | No eligible supplier found |
| `SIMILAR_NOT_EXACT_MATCH` | AI reframed demand, partial match |

### SSE Event Format

```
event: step
data: { "step": "parsing", "status": "active"|"done", "pct": 20, "thinking": "..." }

event: result
data: { "request_id": "R-0093", "confidence_score": 82, "recommendation": {...}, ... }

event: error
data: { "message": "..." }
```

---

## 9. Roles & Permissions

| Action | requester | manager | admin |
|--------|-----------|---------|-------|
| Submit a request | ✓ | ✓ | ✓ |
| View own requests (`/my-requests`) | ✓ | ✓ | ✓ |
| Save / manage drafts | ✓ | ✓ | ✓ |
| Claim a request | ✓ | ✓ | ✓ |
| View approval queue | — | ✓ (own queue) | ✓ (all) |
| Approve / Reject requests | — | ✓ | ✓ |
| View any request status | — | ✓ | ✓ |
| Create manager/admin accounts | — | — | ✓ |

### Approver Routing

The pipeline resolves a `requiredApprover` title from the escalation hierarchy. This title is mapped to a real email in `lib/users.js`:

| Title | Email |
|-------|-------|
| Procurement Manager | alice@company.com |
| Head of Category | bob@company.com |
| Head of Strategic Sourcing | charlie@company.com |
| CPO | cpo@company.com |

Managers only see requests where `required_approver` matches their own title.

---

## 10. Approval Workflow

```
Request submitted (process-stream)
        │
        ├── isAutoApproved = true (tier 1, no issues, no escalations)
        │       └── status: AUTO_APPROVED ✓
        │
        └── isAutoApproved = false
                │
                ├── sendApprovalEmail → approver
                ├── scheduleReminder (24h, then every 48h)
                └── status: PENDING_APPROVAL
                        │
                        ├── Manager approves → POST /api/requests/[id]/approve
                        │       ├── cancelReminder
                        │       ├── logAuditEvent(REQUEST_APPROVED, userId: session.id)
                        │       ├── setDecision(APPROVED)
                        │       └── sendDecisionEmail → requester
                        │
                        └── Manager rejects → POST /api/requests/[id]/reject
                                ├── cancelReminder
                                ├── logAuditEvent(REQUEST_REJECTED, userId: session.id)
                                ├── setDecision(REJECTED)
                                └── sendDecisionEmail → requester
```

### Status Polling

The client can poll `GET /api/requests/[id]/status` every few seconds:

```js
const poll = setInterval(async () => {
  const { approval_status, is_final, timeline } = await fetch(
    `/api/requests/${id}/status`,
    { credentials: 'include' }
  ).then(r => r.json());

  if (is_final) clearInterval(poll); // APPROVED / REJECTED / AUTO_APPROVED
}, 3000);
```

`is_final: true` when no further changes are expected.

---

## 11. Notifications & Reminders

### Email Modes

| Mode | Condition | Behaviour |
|------|-----------|-----------|
| MOCK | No `RESEND_API_KEY` | Logs to console only, no real email sent |
| RESEND | `RESEND_API_KEY` set | Sends real emails via Resend API |

### Email Types

| Type | Sent to | When |
|------|---------|------|
| Decision email | Requester | Always — after pipeline completes |
| Approval request | Approver | When `isAutoApproved === false` |
| Reminder | Approver | After 24h if no action, then every 48h |
| Decision (approve/reject) | Requester | When manager takes action |

### Reminder Lifecycle

```
scheduleReminder()     ← called after sendApprovalEmail()
      ↓
checkPendingReminders() ← call from GET /api/reminders/check or a cron job
      ↓
cancelReminder()       ← called automatically on approve or reject
```

---

## 12. Lib Modules

### Core Pipeline

| Module | Purpose |
|--------|---------|
| `intakeAgent.js` | Azure OpenAI: free text → structured `{category, quantity, budget, ...}` |
| `policyEngine.js` | Checks approval tier, preferred supplier, category rules, geography |
| `supplierScorer.js` | Weighted scoring: price 30%, lead time 30%, quality 20%, risk 10%, ESG 10% |
| `decisionEngine.js` | Azure OpenAI: generates `{status, decision_summary, justification}` |
| `escalationRouter.js` | Builds 6-level escalation chain (ER-001 to ER-006) |
| `confidenceScorer.js` | 0-100 confidence score with named drivers |
| `historicalLookup.js` | Finds past contracts matching category + region |
| `bundlingDetector.js` | Identifies consolidation opportunities |

### Auth & Session

| Module | Purpose |
|--------|---------|
| `session.js` | Sign / verify HMAC cookies, `getSessionFromRequest(req)` |
| `users.js` | Hardcoded accounts + `APPROVER_EMAIL_MAP` |
| `userStore.js` | File-backed registered accounts (`data/users.json`) |

### Persistence Stores

| Module | File | Purpose |
|--------|------|---------|
| `auditLogger.js` | `data/audit_log.json` | Every pipeline and workflow event |
| `approvalStore.js` | `data/approvals.json` | Approve / reject decisions |
| `draftStore.js` | `data/drafts.json` | Saved request drafts |
| `requestOwnerStore.js` | `data/request_owners.json` | Requester → request mapping |
| `requestCounter.js` | `data/request_counter.json` | R-XXXX ID generation + history |

### Notifications

| Module | Purpose |
|--------|---------|
| `notificationService.js` | `sendApprovalEmail`, `sendDecisionEmail`, `sendReminderEmail` |
| `reminderService.js` | `scheduleReminder`, `cancelReminder`, `checkPendingReminders` |
| `emailTemplates.js` | HTML + plain-text email builders (pure functions) |

---

*Built by ChainIQ · HackApp 2026*
