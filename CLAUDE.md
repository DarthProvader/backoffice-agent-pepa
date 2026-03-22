# Back Office Operations Agent — Development Guide

## Project Overview
Back office agent for a Czech real estate company. The agent helps manager "Pepa" with daily operations — querying data, generating reports, writing emails, scheduling tasks, monitoring market listings.

## Architecture
- **server/** — Node.js backend (Express + WebSocket + grammY Telegram bot + node-cron scheduler)
- **web/** — Next.js frontend deployed on Vercel
- **data/** — SQLite database, scheduled tasks, outputs (on VPS, not in git)
- **.claude/skills/** — Custom skills for the agent runtime

## Tech Stack
- Runtime: `@anthropic-ai/claude-agent-sdk` (query() function)
- Server: Express + ws + node-cron + grammY
- Frontend: Next.js 14+, Tailwind CSS, Recharts
- Database: SQLite via `better-sqlite3` (for seed/stats), agent queries via `sqlite3` CLI
- Language: TypeScript throughout

## Key Patterns
- **Single entry point**: All inputs (web, Telegram, cron) call `handleMessage()` in `server/src/agent.ts`
- **Agent writes its own SQL**: No custom database tools. Agent has Bash access and knows the DB schema via SKILL.md
- **Skills for documents**: xlsx, pptx, pdf, docx skills handle file generation
- **MCP for integrations**: Google Calendar, Gmail/Resend

## Database
SQLite at `data/backoffice.db`. Tables: clients, properties, leads, sales, viewings, listing_snapshots.
See `.claude/skills/backoffice/SKILL.md` for full schema.

## Commands
```bash
# Server
cd server && bun install         # Install dependencies
cd server && bun run dev         # Start dev server (tsx watch)
cd server && bun run build       # Compile TypeScript
cd server && bun run seed        # Seed database with sample data

# Web
cd web && bun install
cd web && bun run dev            # Start Next.js dev server
cd web && bun run build          # Production build
```

## Conventions
- All user-facing text in Czech
- Currency: "8 900 000 Kč" (space-separated thousands)
- Dates: "24. března 2026"
- Area: "78 m²"
- Decimal comma, not dot
- Generated files go to `data/outputs/`
