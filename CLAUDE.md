# Finanz-Cockpit

Finanz-Tracker (auf Deutsch). **In Migration vom Personal-Tool zur Multi-User-SaaS.** Aktueller Zustand: Vanilla-Frontend + Supabase-Backend (Phase 1).

## Tech Stack

- **HTML + CSS + Vanilla JavaScript** — kein Build, keine npm-Dependencies
- **Supabase** (Postgres + Auth + Storage, EU-Region Frankfurt) als Backend — siehe `docs/supabase-schema.md`
- **Google Fonts** (Fraunces, Bricolage Grotesque, JetBrains Mono) via CDN
- **Supabase JS Client** via ESM-CDN (`https://esm.sh/@supabase/supabase-js@2`) — einziges Modul-Script

Vanilla bleibt — solange es trägt. Build-Step wird eingeführt, wenn die Komplexität es zwingt.

## Lokale Entwicklung

⚠️ **Doppelklick auf `index.html` funktioniert nicht mehr** — ES-Module brauchen HTTP-CORS.

```bash
# Im Projekt-Root:
python -m http.server 8765
# dann http://localhost:8765 öffnen
```

Vor erstem Start: `js/config.example.js` nach `js/config.js` kopieren und Supabase-Credentials eintragen (siehe Kommentare in der Datei). `js/config.js` ist gitignored.

## Projektstruktur

```
fin_tracker_web/
├── index.html              # Einzige HTML-Datei, enthält alle 5 Tabs
├── assets/
│   └── logo.svg            # (aktuell per CSS ausgeblendet)
├── css/
│   ├── base.css            # CSS-Variablen, Themes, Typografie, Atmosphäre
│   ├── layout.css          # Topbar, Container, Grids, Tabs, Navigation
│   └── components.css      # Buttons, Panels, Rows, Inputs, alle UI-Elemente
├── docs/
│   └── supabase-schema.md  # Datenbankschema-Doku (lesbar, mit SQL)
├── supabase/
│   ├── etappe-a-tables.sql # Tabellen + Indexe + Trigger
│   ├── etappe-b-rls.sql    # Row-Level-Security-Policies
│   └── etappe-c-bootstrap.sql # Signup-Trigger (Auto-Bootstrap neuer User)
└── js/                     # Reihenfolge in index.html ist KRITISCH
    ├── data.js             # Statische Defaults (INCOME_BASE_DEF, EXPENSES_DEF, ROUTINE_ITEMS, TIPS_DATA, CAT)
    ├── state.js            # localStorage-Abstraktion (STORAGE_KEY = "fc-state-v4") — wird in Phase 1 durch Supabase ersetzt
    ├── render.js           # DOM-Rendering für Zahlungen, Routine, Tipps
    ├── haushalt.js         # Haushalt-Tab: Vermögen, Monatsrechnung, Barreserve, Kredit
    ├── app.js              # Init, Theme-Toggle, Tab-Switching, Datum, Issue-Nummer
    ├── config.example.js   # Vorlage für Supabase-Credentials (committed)
    ├── config.js           # echte Credentials — GITIGNORED
    └── supabase-client.js  # ES-Modul: erzeugt window.supabase
```

## Script-Reihenfolge

Die JS-Dateien werden in dieser Reihenfolge geladen (siehe `index.html`):

```
data → state → render → haushalt → app
```

**Warum das wichtig ist:** alle Funktionen sind globale Funktionen am `window`-Objekt (kein Module-System). Jede Datei darf nur auf Identifier aus zuvor geladenen Dateien zugreifen. Bei Änderungen niemals die Reihenfolge ändern, ohne die Abhängigkeiten zu prüfen.

## Die fünf Tabs

| Tab | Inhalt |
|-----|--------|
| **Zahlungen** | Einnahmen + Fixausgaben pro Monat abhaken, Beträge & Namen inline editierbar, Extra-Einnahmen hinzufügbar, Fortschrittsbalken, kumulierter Überschuss |
| **Haushalt** | 3×n Grid mit klappbaren Boxen: Vermögen, Monatsrechnung (sync mit Zahlungen), Kredit · Ziel Barreserve, Ziel Notfallkonto |
| **Routine** | Monatscheckliste (Generic, 7 Punkte) |
| **Finanztipps** | Allgemeine Empfehlungen, annehmbar/verwerfbar, Archiv |
| **Sicherung** | Export/Import als JSON-Backup |

## Persistenz

Alles im `localStorage`:

| Key | Inhalt |
|-----|--------|
| `fc-state-v4` | Hauptzustand (siehe unten) |
| `fc-theme` | `"dark"` oder `"light"` |
| `fc-last-export` | Zeitstempel des letzten Exports |
| `fc-collapsed` | UI-Zustand der klappbaren Haushalt-Boxen (`{"box-vermogen":true,...}`) |

### State-Struktur (`fc-state-v4`)

```js
{
  amounts: {                      // Globale Beträge (über alle Monate)
    "inc_gehalt": 2000,
    "exp_miete": 800,
    "hh_aktien": 1000,
    ...
  },
  names: {                        // User-überschriebene Bezeichnungen
    "inc_gehalt": "Mein Gehalt",
    ...
  },
  "2026-4": {                     // Pro Monat-Jahr (Key = "YYYY-M", 0-indexiert)
    incPaid: { "gehalt": true, ... },
    expPaid: { "miete": true, ... },
    routine: { "r1": true, ... },
    extraIncome: [
      { id: "ei1234567890", name: "Bonus", amount: 500 }
    ],
    extraExpense: [
      { id: "ee1234567890", name: "Reparatur", amount: 120 }
    ]
  },
  surplusEntries: {               // Kumulierter Überschuss pro Monat
    "2026-4": 350.50,
    ...
  },
  tipsDismissed: { "t1": true, ... },
  tipsAccepted:  { "t2": true, ... }
}
```

### Export-Format

```json
{
  "version": "fc-v9",
  "exportedAt": "2026-05-25T...",
  "data": { ...komplettes state-Objekt... }
}
```

## Konventionen

- **Globale Funktionen**, keine Module — *Ausnahme:* `supabase-client.js` ist ein ES-Modul und schreibt sich auf `window.supabase`. Die anderen Skripte bleiben non-module und legen Funktionen am `window`-Objekt ab (`addIncome()`, `toggleTheme()`, `render()`, …).
- **Inline-`onclick` im HTML**, kein zentrales Event-Binding. Beim Hinzufügen neuer Buttons im gleichen Stil weitermachen.
- **Re-Render statt diff** — nach jedem State-Change wird `render()` / `renderTips()` / `updateHaushalt()` aufgerufen, das DOM komplett neu erzeugt.
- **CSS-Variablen** in `:root` und `[data-theme="light"]` — Themes werden ausschließlich darüber gesteuert. Keine hardcodierten Farben in `components.css`.
- **Geldbeträge** mit `fmt(n)` formatieren — gibt `"1.234,56 €"` zurück (deutsches Format, Komma als Dezimaltrenner).
- **IDs sind stabile Identifier**, Namen sind frei editierbar. Niemals die `id` ändern, nur den `name`.

## Was NICHT tun

- **Kein Framework hinzufügen** (React, Vue, Svelte etc.) — solange Vanilla trägt.
- **Keinen Build-Schritt einführen** (Vite, Webpack, esbuild) — solange CDN-Imports reichen. Wenn die Komplexität es zwingt (z.B. mehrere Module, TypeScript), neu evaluieren.
- **Keine Slug-Werte** in `INCOME_BASE_DEF` / `EXPENSES_DEF` (oder den entsprechenden Supabase-Seed-Defaults) ändern — würde bestehende User-Daten von ihren Defaults entkoppeln.
- **Script-Reihenfolge in `index.html`** nicht umstellen — non-module Funktionen aus späteren Skripten sind beim Laden früherer noch nicht definiert.
- **`js/config.js` niemals committen** — enthält Supabase-Credentials. Ist in `.gitignore`. Nur `config.example.js` (mit Platzhaltern) ist im Repo.
- **`service_role`-Key niemals ins Frontend** — gehört ausschließlich in Supabase Edge Functions.
- **Personenbezogene Daten** in `data.js` (oder anderswo im Code) hinterlegen — alles Konkrete gehört ins Backend bzw. die Defaults bleiben generisch.

## Verlauf wichtiger Schema-Änderungen

- `fc-state-v3` → `fc-state-v4`: Einführung von `state.names` (User kann Namen überschreiben). Alte Default-IDs für Personalisierung wurden ersetzt durch generische Beispiele (gehalt/nebenjob/sonstiges + miete/strom/internet/streaming).
- **`fc-state-v4` (localStorage) → Supabase (Phase 1)**: Schema-Doku in `docs/supabase-schema.md`, SQL-Migrations in `supabase/etappe-{a,b,c}-*.sql`. Bei der Migration: frischer Start, keine Übernahme alter localStorage-Daten beschlossen.

## Hilfreiche Einstiegspunkte

- Neue Einnahmenkategorie hinzufügen: `data.js` → `INCOME_BASE_DEF`
- Neue Ausgabenkategorie: `data.js` → `EXPENSES_DEF` (mit `cat:` aus `CAT`)
- Berechnung Überschuss anpassen: `js/haushalt.js` → `updateHaushalt()` (Monatsrechnung-Posten werden aus `getIncome()`/`getExpenses()` + Extras gespiegelt, plus Haushalt-eigene `hh_spar` & `hh_var`)
- Neuen Tab hinzufügen: `<div class="tab" onclick="showTab('name',this)">` im Topnav + `<div id="tab-name" class="page">` im Container
- Theme-Farbe ändern: `css/base.css` → `:root` bzw. `[data-theme="light"]`
