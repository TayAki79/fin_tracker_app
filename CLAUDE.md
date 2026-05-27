# Finanz-Cockpit

Finanz-Tracker (auf Deutsch). **Multi-User-SaaS in Phase 1.** Aktueller Zustand: Vanilla-Frontend + Supabase-Backend (Auth + Daten).

## Tech Stack

- **HTML + CSS + Vanilla JavaScript** — kein Build, keine npm-Dependencies
- **Supabase** (Postgres + Auth, EU-Region Frankfurt) — Schema-Doku in `docs/supabase-schema.md`, SQL in `supabase/`
- **Google Fonts** (Fraunces, Bricolage Grotesque, JetBrains Mono) via CDN
- **Supabase JS Client** via ESM-CDN (`https://esm.sh/@supabase/supabase-js@2`) — die einzigen Modul-Scripte

Vanilla bleibt — solange es trägt. Build-Step wird eingeführt, wenn die Komplexität es zwingt.

## Lokale Entwicklung

⚠️ **Doppelklick auf `index.html` funktioniert nicht mehr** — ES-Module brauchen HTTP-CORS.

```bash
# Im Projekt-Root:
python -m http.server 8765
# dann http://localhost:8765 öffnen
```

Vor erstem Start: `js/config.example.js` nach `js/config.js` kopieren und Supabase-Credentials eintragen. `js/config.js` ist gitignored.

## Projektstruktur

```
fin_tracker_web/
├── index.html              # Einzige HTML-Datei, enthält Auth-Gate + alle 4 Tabs
├── assets/
│   └── logo.svg            # (aktuell per CSS ausgeblendet)
├── css/
│   ├── base.css            # CSS-Variablen, Themes, Typografie, Atmosphäre
│   ├── layout.css          # Topbar, Container, Grids, Tabs, Navigation
│   └── components.css      # Buttons, Panels, Rows, Inputs, Auth-Gate, alle UI-Elemente
├── docs/
│   └── supabase-schema.md  # Datenbankschema-Doku (lesbar, mit SQL)
├── supabase/
│   ├── etappe-a-tables.sql            # Tabellen + Indexe + Trigger
│   ├── etappe-b-rls.sql               # Row-Level-Security-Policies
│   ├── etappe-c-bootstrap.sql         # Signup-Trigger (Auto-Bootstrap neuer User)
│   └── etappe-d-positions-snapshot.sql # positions_snapshot-Spalte für monthly_states
└── js/                     # Reihenfolge in index.html ist KRITISCH
    ├── data.js             # Statische Inhalte (MONTHS, TIPS_DATA, CAT)
    ├── state.js            # Supabase-backed In-Memory-Cache (window.stateBootstrap/Teardown)
    ├── render.js           # DOM-Rendering für Zahlungen, Routine, Tipps
    ├── haushalt.js         # Haushalt-Tab: Vermögen, Monatsrechnung, Barreserve, Kredit
    ├── app.js              # Init, Theme-Toggle, Tab-Switching, Datum, Issue-Nummer
    ├── config.example.js   # Vorlage für Supabase-Credentials (committed)
    ├── config.js           # echte Credentials — GITIGNORED
    ├── supabase-client.js  # ES-Modul: erzeugt window.supabase
    └── auth.js             # ES-Modul: Auth-Gate-Logik (Login/Register/Reset) + Bootstrap-Trigger
```

## Script-Reihenfolge

```html
<script src="js/data.js"></script>
<script src="js/state.js"></script>
<script src="js/render.js"></script>
<script src="js/haushalt.js"></script>
<script src="js/app.js"></script>
<script type="module" src="js/supabase-client.js"></script>
<script type="module" src="js/auth.js"></script>
```

Die fünf non-module Skripte definieren Funktionen am `window`-Objekt. Die beiden ES-Module laufen deferred danach. `auth.js` ruft nach erfolgreichem Login `window.stateBootstrap(userId)` auf, lädt damit alle Cache-Daten aus Supabase, und triggert dann `window.fcRenderAll()`. Vor dem Bootstrap wird **nichts** gerendert — die App-DOM bleibt durch die `body.fc-auth-loading`/`fc-auth-signed-out` CSS-Regeln versteckt.

## Die vier Tabs

| Tab | Inhalt |
|-----|--------|
| **Zahlungen** | Einnahmen + Fixausgaben pro Monat abhaken, Beträge & Namen inline editierbar, Extra-Einnahmen hinzufügbar, Fortschrittsbalken, kumulierter Überschuss |
| **Haushalt** | 3×n Grid mit klappbaren Boxen: Vermögen, Monatsrechnung (sync mit Zahlungen), Kredit · Ziel Barreserve, Ziel Notfallkonto |
| **Routine** | Monatscheckliste (per User, default 7 Punkte aus dem Signup-Bootstrap) |
| **Finanztipps** | Allgemeine Empfehlungen (statisch in `data.js → TIPS_DATA`), annehmbar/verwerfbar, Archiv |

## Datenfluss & Persistenz

**Quelle der Wahrheit ist Supabase.** Frontend hält einen In-Memory-Cache (`_cache` in `state.js`), der bei Login aus Supabase befüllt und bei Logout geleert wird.

| Tabelle | Wozu |
|---|---|
| `profiles` | Pro-User-Metadaten (tier, locale) |
| `household` | 1:1, alle Vermögens-/Sparpläne-/Ziel-Beträge (`aktien`, `bar_ziel`, …) |
| `user_preferences` | 1:1, theme + collapsed_boxes (parallel auch in localStorage für Pre-Login-Theme) |
| `positions` | Wiederkehrende Einnahmen/Ausgaben (kind, name, amount, category, …); seed-Defaults aus Bootstrap |
| `one_off_entries` | Pro-Monat-Extras (kind, year, month, name, amount) |
| `monthly_states` | Pro-Monat-Häkchen + surplus_actual + `positions_snapshot` (eingefrorener Stand bei Erstanlage) |
| `routines` | Pro-User-Routine-Items |
| `tips_state` | Pro-User-Status pro Tipp (`dismissed` oder `accepted`; "neutral" = keine Zeile) |

### `positions_snapshot` (in `monthly_states`)

Beim ersten Schreiben in einen Monat wird ein Schnappschuss der aktuellen Positionen (Namen + Beträge) als `jsonb` in der Zeile mitgespeichert. Damit kann ein historischer Monat später korrekt rekonstruiert werden, auch wenn der User die Beträge in `positions` inzwischen geändert hat. Die UI nutzt das noch nicht — der Snapshot wird vorerst nur erfasst.

### Was im localStorage bleibt (per-Device-UI-State)

| Key | Inhalt |
|---|---|
| `fc-theme` | `"dark"` / `"light"` — sofortiges Theme-Match vor Login |
| `fc-collapsed` | Klapp-Zustand der Haushalt-Boxen pro Browser |

Diese werden absichtlich nicht (sofort) auf `user_preferences` synchronisiert — beides ist Device-spezifisch.

## state.js — wichtige Funktionen

| Funktion | Zweck |
|---|---|
| `stateBootstrap(userId)` | Lädt Household, Preferences, Positions, Routines, Monthly States, One-Off Entries, Tips State parallel. |
| `stateTeardown()` | Cache leeren (bei Logout). |
| `stateIsReady()` | Bool — `true` nach erfolgreichem Bootstrap. |
| `getIncome()` / `getExpenses()` | Positionen aus dem Cache, in der von `render.js` erwarteten Form. |
| `getExtraIncome()` / `getExtraExpense()` | One-off-Einträge für den aktuell selektierten Monat. |
| `getRoutines()` | Routine-Items aus dem Cache. |
| `getAmt(id, def)` / `setAmt(id, val)` | Generischer Zugriff: `hh_*` → household-Spalten, `inc_/exp_*` → position-Felder. |
| `getName(id, def)` / `setName(id, val)` | Position-Name lesen/schreiben. |
| `getSurplus/getKumuliert/getSurplusCount` | Kumulierter Überschuss-Werte aus `monthly_states.surplus_actual`. |
| `toggleInc/Exp/Routine`, `dismissTip/restoreTip/acceptTip` | Bool-Toggle + Async-Upsert. |
| `addIncome/addExpense`, `del*`, `edit*` | One-off-Entries verwalten (optimistic mit Temp-IDs). |

Alle Setter sind **optimistic**: Cache wird sofort aktualisiert + `render()` läuft, Supabase-Write feuert im Hintergrund. Bei Fehler erscheint ein Toast; in `_addOneOff`/`_deleteOneOff`/`_updateOneOff` wird der Cache zurückgerollt.

## Konventionen

- **Globale Funktionen**, keine Module — *Ausnahmen:* `supabase-client.js` und `auth.js` sind ES-Module. Die anderen Skripte bleiben non-module und legen Funktionen am `window`-Objekt ab (`addIncome()`, `toggleTheme()`, `render()`, …).
- **Inline-`onclick` im HTML**, kein zentrales Event-Binding. Beim Hinzufügen neuer Buttons im gleichen Stil weitermachen.
- **Re-Render statt diff** — nach jedem State-Change wird `render()` / `renderTips()` / `updateHaushalt()` aufgerufen, das DOM komplett neu erzeugt.
- **CSS-Variablen** in `:root` und `[data-theme="light"]` — Themes werden ausschließlich darüber gesteuert. Keine hardcodierten Farben in `components.css`.
- **Geldbeträge** mit `fmt(n)` formatieren — gibt `"1.234,56 €"` zurück (deutsches Format, Komma als Dezimaltrenner).
- **IDs sind stabile Identifier**, Namen sind frei editierbar. Niemals die `id` ändern, nur den `name`.
- **Body-Klassen** `fc-auth-loading` / `fc-auth-signed-out` / `fc-auth-signed-in` steuern die Sichtbarkeit (Topbar/Container/Auth-Gate). Auth.js wechselt sie.

## Was NICHT tun

- **Kein Framework hinzufügen** (React, Vue, Svelte etc.) — solange Vanilla trägt.
- **Keinen Build-Schritt einführen** — solange CDN-Imports reichen.
- **Default-Werte ändern** im Signup-Bootstrap-Trigger (`supabase/etappe-c-bootstrap.sql`) ohne Migrations-Plan — bestehende User behalten ihre Daten, neue User bekommen die neuen Defaults; Inkonsistenz möglich.
- **Script-Reihenfolge in `index.html`** nicht umstellen.
- **`js/config.js` niemals committen** — enthält Supabase-Credentials. Ist in `.gitignore`.
- **`service_role`-Key niemals ins Frontend** — gehört ausschließlich in Supabase Edge Functions.
- **Personenbezogene Daten** in `data.js` (oder anderswo im Code) hinterlegen — alles Konkrete gehört ins Backend.

## Verlauf wichtiger Schema-Änderungen

- `fc-state-v3` → `fc-state-v4`: Einführung von `state.names` (User kann Namen überschreiben).
- **`fc-state-v4` (localStorage) → Supabase (Phase 1, abgeschlossen)**: Schema in `docs/supabase-schema.md`, SQL-Migrations in `supabase/etappe-{a,b,c,d}-*.sql`. Frischer Start, keine Übernahme alter localStorage-Daten.
- **Etappe D** (`positions_snapshot` in `monthly_states`): historische Monate behalten ihre damaligen Beträge auch nach späterer Edit-Aktion in `positions`.

## Hilfreiche Einstiegspunkte

- Default-Positionen/Routinen ändern: `supabase/etappe-c-bootstrap.sql` (greift nur für neue User).
- Berechnung Überschuss anpassen: `js/haushalt.js` → `updateHaushalt()` (Monatsrechnung-Posten werden aus `getIncome()`/`getExpenses()` + Extras gespiegelt, plus Haushalt-eigene `hh_spar` & `hh_var`).
- Neuen Tab hinzufügen: `<div class="tab" onclick="showTab('name',this)">` im Topnav + `<div id="tab-name" class="page">` im Container.
- Theme-Farbe ändern: `css/base.css` → `:root` bzw. `[data-theme="light"]`.
- Auth-Flow anpassen: `js/auth.js` (`enterApp`/`leaveApp`, `screens.*` Form-Handler).
