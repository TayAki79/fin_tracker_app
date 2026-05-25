# Finanz-Cockpit

Persönliche Finanz-Tracker-Web-App (auf Deutsch). Reine Client-App, keine Backend-Anbindung, kein Build-Tool, kein Framework.

## Tech Stack

- **HTML + CSS + Vanilla JavaScript** — kein Build, kein npm, keine Dependencies
- **localStorage** als einzige Persistenzschicht
- **Google Fonts** (Fraunces, Bricolage Grotesque, JetBrains Mono) via CDN

Bewusste Entscheidung: keine Frameworks, kein Build. Die App soll durch Doppelklick auf `index.html` lauffähig sein.

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
└── js/                     # Reihenfolge in index.html ist KRITISCH
    ├── data.js             # Statische Defaults (INCOME_BASE_DEF, EXPENSES_DEF, ROUTINE_ITEMS, TIPS_DATA, CAT)
    ├── state.js            # localStorage-Abstraktion (STORAGE_KEY = "fc-state-v4")
    ├── render.js           # DOM-Rendering für Zahlungen, Routine, Tipps
    ├── haushalt.js         # Haushalt-Tab: Vermögen, Monatsrechnung, Barreserve, Kredit
    └── app.js              # Init, Theme-Toggle, Tab-Switching, Datum, Issue-Nummer
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
| **Haushalt** | Vermögensübersicht, Monatsbilanz, Barreserven-Ziel, Kredit |
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

- **Globale Funktionen**, keine Module. `addIncome()`, `toggleTheme()`, `render()` etc. liegen am `window`.
- **Inline-`onclick` im HTML**, kein zentrales Event-Binding. Beim Hinzufügen neuer Buttons im gleichen Stil weitermachen.
- **Re-Render statt diff** — nach jedem State-Change wird `render()` / `renderTips()` / `updateHaushalt()` aufgerufen, das DOM komplett neu erzeugt.
- **CSS-Variablen** in `:root` und `[data-theme="light"]` — Themes werden ausschließlich darüber gesteuert. Keine hardcodierten Farben in `components.css`.
- **Geldbeträge** mit `fmt(n)` formatieren — gibt `"1.234,56 €"` zurück (deutsches Format, Komma als Dezimaltrenner).
- **IDs sind stabile Identifier**, Namen sind frei editierbar. Niemals die `id` ändern, nur den `name`.

## Lokal laufen lassen

Doppelklick auf `index.html` reicht. Für saubere Entwicklung mit Hot-Reload:

```bash
python -m http.server 8765
# dann http://localhost:8765 öffnen
```

Es gibt keinen npm-Workflow.

## Was NICHT tun

- **Kein Framework hinzufügen** (React, Vue, Svelte etc.). Die App ist bewusst Vanilla.
- **Keinen Build-Schritt einführen** (Vite, Webpack, esbuild). HTML/CSS/JS werden direkt vom Browser geladen.
- **Keine Datei-IDs ändern** in `INCOME_BASE_DEF` / `EXPENSES_DEF` — alle existierenden localStorage-Verknüpfungen würden brechen.
- **Script-Reihenfolge in `index.html`** nicht umstellen — Funktionen aus späteren Skripten sind beim Laden früherer noch nicht definiert.
- **Personenbezogene Daten** in `data.js` (oder anderswo im Code) hinterlegen — alles Konkrete gehört in localStorage. Defaults sind generische Beispielwerte.

## Verlauf wichtiger Schema-Änderungen

- `fc-state-v3` → `fc-state-v4`: Einführung von `state.names` (User kann Namen überschreiben). Alte Default-IDs für Personalisierung (gehalt/pflegegeld/de_rente/sozial/fr_rente, sowie ein Dutzend Ausgaben-IDs wie targo/canadalife/spotify/...) wurden ersetzt durch generische Beispiele (gehalt/nebenjob/sonstiges + miete/strom/internet/streaming).

## Hilfreiche Einstiegspunkte

- Neue Einnahmenkategorie hinzufügen: `data.js` → `INCOME_BASE_DEF`
- Neue Ausgabenkategorie: `data.js` → `EXPENSES_DEF` (mit `cat:` aus `CAT`)
- Berechnung Überschuss anpassen: `js/haushalt.js` → `updateHaushalt()`
- Neuen Tab hinzufügen: `<div class="tab" onclick="showTab('name',this)">` im Topnav + `<div id="tab-name" class="page">` im Container
- Theme-Farbe ändern: `css/base.css` → `:root` bzw. `[data-theme="light"]`
