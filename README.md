# Back Office Operations Agent („Pepa")

AI asistent pro back office realitní firmy. Postavený nad **Claude Agent SDK** — místo pevně naprogramovaných databázových nástrojů agent zná schéma databáze a **píše si vlastní SQL, Python a shell příkazy** podle toho, co uživatel potřebuje.

Vznikl jako řešení zadané výzvy: navrhnout systém, který převezme významnou část práce back office manažera („Pepy") — dotazy nad daty, reporty, e-maily, plánování prohlídek a monitoring trhu.

> **Poznámka k datům:** Databáze obsahuje výhradně **synteticky generovaná** testovací data (náhodná jména, adresy, ceny). Žádná reálná firemní ani osobní data.

---

## Co agent umí

Všechny scénáře ze zadání jsou funkční a otestované:

| Požadavek | Jak to agent řeší |
|-----------|-------------------|
| „Jaké nové klienty máme za Q1? Odkud přišli? Znázorni to graficky." | Napíše si SQL dotaz, spočítá rozpad podle zdroje, vygeneruje graf přes matplotlib |
| „Vytvoř graf vývoje leadů a prodejů za posledních 6 měsíců." | Agreguje data po měsících, vrátí graf + tabulku |
| „Napiš e-mail zájemci a navrhni termín prohlídky podle mé dostupnosti." | Zkontroluje Google Calendar, najde volné sloty, připraví návrh e-mailu (neodešle bez potvrzení) |
| „Najdi nemovitosti s chybějícími daty o rekonstrukci a připrav seznam k doplnění." | Dotáže se na `NULL` hodnoty, vrátí přehled a doporučí další krok |
| „Shrň výsledky týdne do reportu a připrav prezentaci se 3 slidy." | Vygeneruje Excel/PDF report i PPTX prezentaci |
| „Sleduj realitní servery a každé ráno mě informuj o nových nabídkách v Holešovicích." | Zapíše naplánovanou úlohu, cron ji spouští, výsledky posílá na Telegram |

---

## Architektura

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Web (Next) │     │  Telegram   │     │  Cron / plán │
│  chat + UI  │     │     bot     │     │    úlohy     │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                  handleMessage()  ◄── jeden vstupní bod
                           │
                  Claude Agent SDK (query)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Bash / SQL        Python skripty      Skilly (.claude)
   (SQLite)          (Gmail, Calendar,   (backoffice, google,
                      dokumenty)          xlsx/pptx/pdf/docx)
```

### Klíčová designová rozhodnutí

- **Jeden vstupní bod** — web, Telegram i cron volají stejnou funkci `handleMessage()` ([server/src/agent.ts](server/src/agent.ts)). Žádná duplikace logiky.
- **Agent si píše vlastní SQL** — žádné custom „get_clients" nástroje. Agent dostane přes [SKILL.md](.claude/skills/backoffice/SKILL.md) schéma databáze a použije `sqlite3` CLI přímo. Flexibilní na jakýkoli dotaz bez psaní nových endpointů.
- **Skilly jako znalostní balíčky** — instrukce, DB schéma a formátovací pravidla žijí v `.claude/skills/`, ne v kódu. Agent je načítá progresivně podle kontextu.
- **Plánování bez session-only nástrojů** — místo `CronCreate` (funguje jen v rámci jedné session) agent zapisuje úlohy do `data/scheduled-tasks/tasks.json`; server soubor sleduje (`fs.watchFile`) a registruje cron joby ([server/src/scheduler.ts](server/src/scheduler.ts)).
- **Detekce artefaktů** — když agent vygeneruje soubor do `data/outputs/`, backend to zachytí a přes WebSocket pošle frontendu, který ho zobrazí v náhledovém panelu.

---

## Tech stack

**Backend** ([server/](server/))
- Bun + TypeScript, Express + `ws` (WebSocket streaming)
- `@anthropic-ai/claude-agent-sdk` — jádro agenta
- SQLite (`better-sqlite3` pro seed/statistiky; agent dotazuje přes `sqlite3` CLI)
- grammY (Telegram bot), node-cron (scheduler), JWT auth

**Frontend** ([web/](web/)) — nasazeno na Vercelu
- Next.js 16, React 19, Tailwind CSS v4
- Chat se streamováním v Claude Code stylu (tool cally inline jako rozbalovací karty)
- Recharts, náhledy dokumentů: react-pdf (PDF), SheetJS (XLSX), mammoth.js (DOCX)
- Dashboard: přehled dat, správa úloh, správa souborů

**Integrace & dokumenty**
- Google Gmail + Calendar přes Python skripty ([scripts/](scripts/))
- Generování xlsx / pptx / pdf / docx (Python + pptxgenjs)

**Deployment**
- Backend v Dockeru na VPS, Caddy reverse proxy s automatickým SSL
- Frontend na Vercelu

---

## Struktura repozitáře

```
server/          Backend — Express, WebSocket, agent, scheduler, Telegram bot
  src/agent.ts     Obálka nad Claude Agent SDK (jeden vstupní bod)
  src/index.ts     HTTP + WebSocket server, file serving, artifact detekce
  src/scheduler.ts node-cron scheduler čtoucí tasks.json
  src/telegram.ts  grammY bot + notifikace
web/             Frontend — Next.js chat, dashboard, náhledy dokumentů
scripts/         Python skripty pro Gmail a Google Calendar
.claude/skills/  Skilly agenta (backoffice, google)
data/            SQLite DB, výstupy, úlohy (generováno, není v gitu)
```

> Skilly pro generování dokumentů (`xlsx`, `pptx`, `pdf`, `docx`) pocházejí z [anthropics/skills](https://github.com/anthropics/skills) a nejsou součástí tohoto repozitáře kvůli jejich licenci.

---

## Lokální spuštění

**Předpoklady:** [Bun](https://bun.sh), Python 3.11+, přístup ke Claude (Claude Code auth nebo `ANTHROPIC_API_KEY`).

```bash
# 1. Backend
cd server
bun install
cp ../.env.example .env        # doplň hodnoty (viz níže)
bun run seed                   # naplní SQLite syntetickými daty
bun run dev                    # server na http://localhost:3001

# 2. Frontend (druhý terminál)
cd web
bun install
bun run dev                    # web na http://localhost:3000
```

### Konfigurace (`server/.env`)

Vzor viz [.env.example](.env.example). Minimum pro lokální běh:

| Proměnná | Popis |
|----------|-------|
| `ANTHROPIC_API_KEY` | Volitelné — když prázdné, použije se Claude Code auth |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Přihlášení do webového UI |
| `AUTH_JWT_SECRET` | Náhodný řetězec pro podpis JWT |
| `TELEGRAM_BOT_TOKEN` | Volitelné — pro Telegram bota |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | Volitelné — pro Gmail a Calendar |

Žádné reálné klíče nejsou v repozitáři — vše se načítá z `.env`, který je v `.gitignore`.

---

## Databázové schéma

SQLite, tabulky: `clients`, `properties`, `leads`, `sales`, `viewings`, `listing_snapshots`.
Kompletní schéma a příklady dotazů viz [.claude/skills/backoffice/SKILL.md](.claude/skills/backoffice/SKILL.md).
