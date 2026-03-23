---
name: google-integration
description: >
  Použij tento skill když uživatel mluví o emailech, kalendáři, prohlídkách,
  schůzkách, dostupnosti, plánování, odesílání zpráv, pozvánkách, Gmail,
  nebo Google Calendar. Také použij když chce naplánovat prohlídku nemovitosti
  s klientem nebo poslat email zájemci.
---

# Google integrace — Gmail + Calendar

K dispozici máš Python skripty pro práci s Gmail a Google Calendar.
Spouštěj je přes Bash s venv Pythonem.

## Gmail

### Odeslat email
```bash
.venv/Scripts/python scripts/gmail_send.py \
  --to "adresa@email.cz" \
  --subject "Předmět emailu" \
  --body "Text emailu..."
```
Volitelné: `--cc "kopie@email.cz"` `--bcc "skryta@email.cz"`

### Číst/hledat emaily
```bash
# Posledních 10 emailů
.venv/Scripts/python scripts/gmail_read.py --max 10

# Nepřečtené
.venv/Scripts/python scripts/gmail_read.py --unread

# Hledat podle odesílatele
.venv/Scripts/python scripts/gmail_read.py --query "from:novak@email.cz"

# S plným textem emailu
.venv/Scripts/python scripts/gmail_read.py --query "subject:prohlídka" --full
```

## Google Calendar

### Výpis událostí
```bash
# Příštích 7 dní
.venv/Scripts/python scripts/calendar_list.py --days 7

# Konkrétní den
.venv/Scripts/python scripts/calendar_list.py --date 2026-03-25
```

### Vytvořit událost
```bash
.venv/Scripts/python scripts/calendar_create.py \
  --summary "Prohlídka - Holešovice" \
  --start "2026-03-25T14:00" \
  --end "2026-03-25T15:00" \
  --location "Milady Horákové 63, Praha 7" \
  --description "Prohlídka bytu 3+kk s klientem Novákem"
```
Volitelné: `--attendees "novak@email.cz,kolega@firma.cz"`

### Volné sloty
```bash
.venv/Scripts/python scripts/calendar_free.py --date 2026-03-25
```
Vrátí volné časové bloky v pracovní době (9:00–17:00).

## Pravidla
- Při odesílání emailu VŽDY nejdřív navrhni text a čekej na potvrzení uživatele
- Nikdy neposílej email bez explicitního souhlasu
- Při plánování prohlídky zkontroluj volné sloty v kalendáři
- Formát data: YYYY-MM-DD pro den, YYYY-MM-DDTHH:MM pro čas
- Všechny výstupy jsou JSON — parsuj je a prezentuj česky
