# Back Office Agent — Progress

## MVP (22. března 2026)

### Co bylo implementováno
- **Monorepo struktura**: `server/`, `web/`, `data/`, `.claude/skills/`
- **CLAUDE.md**: instrukce pro vývoj projektu
- **SQLite databáze** se seed daty:
  - 55 klientů (15 v Q1 2026, různé zdroje)
  - 35 nemovitostí (8+ s chybějícími daty o rekonstrukci)
  - 120 leadů (rostoucí trend za 6 měsíců)
  - 25 prodejů, 45 prohlídek, 18 listing snapshotů
- **server/src/agent.ts**: `handleMessage()` wrapper kolem Claude Agent SDK `query()`
- **server/src/index.ts**: Express server + WebSocket endpoint
- **Backoffice SKILL.md**: DB schéma, formátovací pravidla, instrukce pro agenta
- **REST API**: `POST /api/chat` (one-shot), `WS /ws` (streaming)

### Ověřeno
- Claude Agent SDK funguje s Team subscription (žádný API key nutný)
- Agent automaticky načítá SKILL.md, zná schéma, píše si SQL sám
- Use case 1 otestován: "Noví klienti za Q1 2026" → tabulka + rozpad po zdrojích
- Odpovědi česky, formátované tabulky, follow-up návrhy
- Cena ~$0.05 za dotaz

### Známé issues
- Na Windows Git Bash přepisuje absolutní cesty začínající `/data/` → agent se sám opraví, v SKILL.md použit `find` workaround

---

## Další kroky (podle implementation-plan.txt)
- [ ] Telegram bot (grammY)
- [ ] Web UI (Next.js) — chat se streamováním
- [ ] Scheduler (node-cron) pro opakované úlohy
- [ ] MCP integrace (Google Calendar, Gmail/Resend)
- [ ] Document skills (xlsx, pptx, pdf, docx)
- [ ] Dashboard + stats endpoint
- [ ] Web Push notifikace
- [ ] Deploy (VPS + Vercel)
- [ ] Demo video
