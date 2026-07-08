# Back Office Operations Agent ("Pepa")

An AI assistant for the back office of a real estate company. Built on the **Claude Agent SDK** — instead of hard-coded database tools, the agent knows the database schema and **writes its own SQL, Python and shell commands** based on what the user needs.

It was built as a solution to a given challenge: design a system that takes over a significant part of a back office manager's ("Pepa's") work — querying data, generating reports, writing emails, scheduling viewings and monitoring the market.

> **Note on data:** The database contains exclusively **synthetically generated** test data (random names, addresses, prices). No real company or personal data.

---

## What the agent can do

All scenarios from the challenge are functional and tested:

| Request | How the agent handles it |
|---------|--------------------------|
| "How many new clients did we get in Q1? Where did they come from? Show it visually." | Writes its own SQL query, computes the breakdown by source, generates a chart via matplotlib |
| "Create a chart of lead and sale trends over the last 6 months." | Aggregates data by month, returns a chart + table |
| "Write an email to a prospect and suggest a viewing time based on my availability." | Checks Google Calendar, finds free slots, drafts the email (never sends without confirmation) |
| "Find properties with missing renovation data and prepare a list to complete." | Queries for `NULL` values, returns an overview and recommends next steps |
| "Summarize this week's results into a report and prepare a 3-slide presentation." | Generates an Excel/PDF report as well as a PPTX presentation |
| "Monitor real estate portals and notify me every morning about new listings in Holešovice." | Registers a scheduled task, cron runs it, results are sent to Telegram |

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Web (Next) │     │  Telegram   │     │ Cron / tasks │
│  chat + UI  │     │     bot     │     │  (schedule)  │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                  handleMessage()  ◄── single entry point
                           │
                  Claude Agent SDK (query)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Bash / SQL        Python scripts     Skills (.claude)
   (SQLite)          (Gmail, Calendar,   (backoffice, google,
                      documents)          xlsx/pptx/pdf/docx)
```

### Key design decisions

- **Single entry point** — web, Telegram and cron all call the same `handleMessage()` function ([server/src/agent.ts](server/src/agent.ts)). No duplicated logic.
- **The agent writes its own SQL** — no custom "get_clients" tools. Via [SKILL.md](.claude/skills/backoffice/SKILL.md) the agent receives the database schema and uses the `sqlite3` CLI directly. Flexible for any query without writing new endpoints.
- **Skills as knowledge packages** — instructions, the DB schema and formatting rules live in `.claude/skills/`, not in the code. The agent loads them progressively based on context.
- **Scheduling without session-only tools** — instead of `CronCreate` (which only works within a single session) the agent writes tasks to `data/scheduled-tasks/tasks.json`; the server watches the file (`fs.watchFile`) and registers cron jobs ([server/src/scheduler.ts](server/src/scheduler.ts)).
- **Artifact detection** — when the agent generates a file into `data/outputs/`, the backend catches it and pushes it to the frontend over WebSocket, which displays it in a preview panel.

---

## Tech stack

**Backend** ([server/](server/))
- Bun + TypeScript, Express + `ws` (WebSocket streaming)
- `@anthropic-ai/claude-agent-sdk` — the core of the agent
- SQLite (`better-sqlite3` for seeding/statistics; the agent queries via the `sqlite3` CLI)
- grammY (Telegram bot), node-cron (scheduler), JWT auth

**Frontend** ([web/](web/)) — deployed on Vercel
- Next.js 16, React 19, Tailwind CSS v4
- Claude Code-style streaming chat (tool calls shown inline as collapsible cards)
- Recharts, document previews: react-pdf (PDF), SheetJS (XLSX), mammoth.js (DOCX)
- Dashboard: data overview, task management, file management

**Integrations & documents**
- Google Gmail + Calendar via Python scripts ([scripts/](scripts/))
- Generation of xlsx / pptx / pdf / docx (Python + pptxgenjs)

**Deployment**
- Backend in Docker on a VPS, Caddy reverse proxy with automatic SSL
- Frontend on Vercel

---

## Repository structure

```
server/          Backend — Express, WebSocket, agent, scheduler, Telegram bot
  src/agent.ts     Wrapper around the Claude Agent SDK (single entry point)
  src/index.ts     HTTP + WebSocket server, file serving, artifact detection
  src/scheduler.ts node-cron scheduler reading tasks.json
  src/telegram.ts  grammY bot + notifications
web/             Frontend — Next.js chat, dashboard, document previews
scripts/         Python scripts for Gmail and Google Calendar
.claude/skills/  Agent skills (backoffice, google)
data/            SQLite DB, outputs, tasks (generated, not in git)
```

> The document-generation skills (`xlsx`, `pptx`, `pdf`, `docx`) come from [anthropics/skills](https://github.com/anthropics/skills) and are not included in this repository due to their license.

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh), Python 3.11+, access to Claude (Claude Code auth or `ANTHROPIC_API_KEY`).

```bash
# 1. Backend
cd server
bun install
cp ../.env.example .env        # fill in the values (see below)
bun run seed                   # populate SQLite with synthetic data
bun run dev                    # server at http://localhost:3001

# 2. Frontend (second terminal)
cd web
bun install
bun run dev                    # web at http://localhost:3000
```

### Configuration (`server/.env`)

See [.env.example](.env.example) for a template. Minimum for a local run:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional — if empty, Claude Code auth is used |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Login for the web UI |
| `AUTH_JWT_SECRET` | Random string for signing JWTs |
| `TELEGRAM_BOT_TOKEN` | Optional — for the Telegram bot |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | Optional — for Gmail and Calendar |

No real keys are in the repository — everything is loaded from `.env`, which is in `.gitignore`.

---

## Database schema

SQLite, tables: `clients`, `properties`, `leads`, `sales`, `viewings`, `listing_snapshots`.
For the full schema and example queries see [.claude/skills/backoffice/SKILL.md](.claude/skills/backoffice/SKILL.md).
