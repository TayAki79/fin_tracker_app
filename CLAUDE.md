# Finanz-Cockpit

Finanz-Tracker (auf Deutsch). **Multi-User-SaaS in Phase 1.** Aktueller Zustand: Vanilla-Frontend + Supabase-Backend (Auth + Daten).

## Tech Stack

- **HTML + CSS + Vanilla JavaScript** — kein Build, keine npm-Dependencies
- **Supabase** (Postgres + Auth, EU-Region Frankfurt) — Schema-Doku in `docs/supabase-schema.md`, SQL in `supabase/`
- **Fonts lokal selbst gehostet** (Fraunces, Bricolage Grotesque, JetBrains Mono) — `css/fonts.css` + `assets/fonts/*.woff2` (Subsets latin + latin-ext für DE/EN). Keine Google-Fonts-CDN zur Laufzeit.
- **Supabase JS Client** lokal als UMD-Bundle (`js/vendor/supabase-js@2.39.8.umd.js`) — setzt `window.supabase` als Library-Namespace, keine ESM-CDN-Abhängigkeit mehr. `supabase-client.js` + `auth.js` bleiben die einzigen ES-Module und lesen `createClient` aus dem UMD-Global.

Vanilla bleibt — solange es trägt. Build-Step wird eingeführt, wenn die Komplexität es zwingt. **Phase 2: keine externen Laufzeit-Abhängigkeiten im Frontend** mehr (Vorbereitung fürs Capacitor-Wrapping). Ausnahme: die Edge Function `delete-account` importiert serverseitig (Deno) weiter von esm.sh — das ist kein Client-Runtime-Concern.

## Lokale Entwicklung

⚠️ **Doppelklick auf `index.html` funktioniert nicht mehr** — ES-Module brauchen HTTP-CORS.

```bash
# Im Projekt-Root:
python -m http.server 8765
# dann http://localhost:8765 öffnen
```

Vor erstem Start: `js/config.example.js` nach `js/config.js` kopieren und Supabase-Credentials eintragen. `js/config.js` ist gitignored.

## Betrieb / Infrastruktur

- **Supabase Keep-Alive** (`.github/workflows/supabase-keepalive.yml`): GitHub Action, die alle 4 Stunden die REST-API gegen `profiles` pingt. Das Supabase-Free-Tier-Projekt pausiert nach 7 Tagen Inaktivität (→ 30–60 s Cold-Start); der Cron-Ping hält es dauerhaft wach. Braucht die Repo-Secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY` (nur Anon-Key, kein `service_role`). HTTP 200 **oder** 401 gelten als Erfolg — beide bedeuten, dass die Query durch Postgres lief.
- **Edge Functions** (`supabase/functions/`): Deno-Functions für alles, was den `service_role`-Key braucht. Aktuell: `delete-account` (in-App Konto-Löschung, DSGVO + Apple-Pflicht). Deployment je Function via `supabase functions deploy <name>` — Details im jeweiligen `README.md`. Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) injiziert Supabase automatisch. Frontend ruft sie via `supabase.functions.invoke(...)` mit dem User-JWT — die Function leitet die `user.id` aus dem Token ab, nie aus dem Body. **Erst nach Deployment funktioniert der „Konto löschen"-Flow** (User-Chip oben rechts → Konto → Gefahrenzone).
- **Deployment / Hosting** (Phase 2.5): Static-Hosting auf **Hostinger**, Domain **`akradev.de`** (vorerst privates Staging/Test). Frontend-Dateien liegen in `public_html`. Quelle ist GitHub (Git-Deploy). **Drei Konfig-Punkte, die NICHT im Repo stehen und manuell auf dem Server/in Supabase gesetzt werden:** (1) `js/config.js` (gitignored) muss auf dem Server existieren; (2) in Supabase unter *Authentication → URL Configuration* müssen **Site URL** + **Redirect URLs** die Produktions-Domain `https://akradev.de` enthalten, sonst zeigen Verify-/Reset-Mails auf localhost; (3) HTTPS/SSL für die Domain aktiv. `service_role`-Key und `supabase/`-SQL gehören NICHT auf den Webserver.

## Projektstruktur

```
fin_tracker_web/
├── index.html              # Einzige HTML-Datei, enthält Auth-Gate + alle 4 Tabs
├── .github/
│   └── workflows/
│       └── supabase-keepalive.yml  # Cron-Ping alle 4h gegen Free-Tier-Schlaf
├── assets/
│   ├── logo.svg            # (aktuell per CSS ausgeblendet)
│   └── fonts/              # Lokale woff2 (Fraunces, Bricolage, JetBrains Mono)
├── css/
│   ├── fonts.css           # @font-face für die lokalen woff2 (latin + latin-ext)
│   ├── base.css            # CSS-Variablen, Themes, Typografie, Atmosphäre
│   ├── layout.css          # Topbar, Container, Grids, Tabs, Navigation
│   └── components.css      # Buttons, Panels, Rows, Inputs, Auth-Gate, alle UI-Elemente
├── docs/
│   └── supabase-schema.md  # Datenbankschema-Doku (lesbar, mit SQL)
├── supabase/
│   ├── etappe-a-tables.sql            # Tabellen + Indexe + Trigger
│   ├── etappe-b-rls.sql               # Row-Level-Security-Policies
│   ├── etappe-c-bootstrap.sql         # Signup-Trigger (Auto-Bootstrap neuer User)
│   ├── etappe-d-positions-snapshot.sql # positions_snapshot-Spalte für monthly_states
│   ├── etappe-e-rls-audit.sql          # Read-only RLS-Verifikation (Isolation beweisen)
│   └── functions/
│       └── delete-account/             # Edge Function: Konto-Löschung (service_role)
│           ├── index.ts                # Deno-Function: admin.deleteUser(self)
│           └── README.md               # Deploy-Anleitung (supabase functions deploy)
└── js/                     # Reihenfolge in index.html ist KRITISCH
    ├── vendor/
    │   └── supabase-js@2.39.8.umd.js  # Lokales Supabase-Bundle (window.supabase-Library)
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
<script src="js/vendor/supabase-js@2.39.8.umd.js"></script>
<script src="js/data.js"></script>
<script src="js/state.js"></script>
<script src="js/render.js"></script>
<script src="js/haushalt.js"></script>
<script src="js/app.js"></script>
<script type="module" src="js/supabase-client.js"></script>
<script type="module" src="js/auth.js"></script>
```

Das UMD-Bundle (klassisches Script) läuft als erstes und setzt `window.supabase` als Library-Namespace. Die fünf non-module App-Skripte definieren Funktionen am `window`-Objekt. Die beiden ES-Module laufen deferred danach — `supabase-client.js` liest `createClient` aus dem UMD-Global und ersetzt `window.supabase` durch die Client-Instanz. `auth.js` ruft nach erfolgreichem Login `window.stateBootstrap(userId)` auf, lädt damit alle Cache-Daten aus Supabase, und triggert dann `window.fcRenderAll()`. Vor dem Bootstrap wird **nichts** gerendert — die App-DOM bleibt durch die `body.fc-auth-loading`/`fc-auth-signed-out` CSS-Regeln versteckt.

## Die vier Tabs

| Tab | Inhalt |
|-----|--------|
| **Zahlungen** | Einnahmen + Fixausgaben pro Monat abhaken, Beträge & Namen inline editierbar, Extra-Einnahmen hinzufügbar, Fortschrittsbalken, kumulierter Überschuss + **Monatsübertrag** (Kum-Box zeigt Plan-Überschuss vs. Ist-Eingabe + Differenz) |
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
| `fc-onboarded-<userId>` | Flag: Willkommens-Overlay für diesen User schon gesehen (per-Device) |

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

Alle Setter sind **optimistic**: Cache wird sofort aktualisiert + `render()` läuft, Supabase-Write feuert im Hintergrund. Bei Fehler erscheint ein **roter Fehler-Toast** (`showToast(msg, "error")`) und der Cache wird zurückgerollt + neu gerendert — bei den One-off-Settern (`_addOneOff`/`_deleteOneOff`/`_updateOneOff`) und seit Phase 2 auch bei den geld-kritischen Inline-Edits `setAmt`/`setName` (Haushalt-Beträge, Positions-Name/-Betrag; Rollback via `_rerenderAll()`). Monatsstatus-/Tip-Toggles zeigen nur den Fehler-Toast ohne Rollback (Verlust = ein nicht-persistiertes Häkchen, kein Geldwert).

**Offline-Erkennung** (`app.js`): `body.fc-offline` schaltet einen roten Banner ein (`#offline-banner`), sobald das `offline`-Event feuert; `window.fcIsOnline()` steht als Guard bereit. Optimistische Writes laufen offline trotzdem an, scheitern und rollen zurück — der Banner erklärt warum.

## Konventionen

- **Globale Funktionen**, keine Module — *Ausnahmen:* `supabase-client.js` und `auth.js` sind ES-Module. Die anderen Skripte bleiben non-module und legen Funktionen am `window`-Objekt ab (`addIncome()`, `toggleTheme()`, `render()`, …).
- **Inline-`onclick` im HTML**, kein zentrales Event-Binding. Beim Hinzufügen neuer Buttons im gleichen Stil weitermachen.
- **Re-Render statt diff** — nach jedem State-Change wird `render()` / `renderTips()` / `updateHaushalt()` aufgerufen, das DOM komplett neu erzeugt.
- **CSS-Variablen** in `:root` und `[data-theme="light"]` — Themes werden ausschließlich darüber gesteuert. Keine hardcodierten Farben in `components.css`.
- **Responsive/Touch** (Phase 2): Breakpoints bei 980px + 600px (`layout.css`); Mobile-/Touch-Block am Ende von `components.css`. Auf `@media (hover: none)` müssen hover-versteckte Elemente (z.B. `.edit-btn`) sichtbar sein — sonst am Handy unbenutzbar. Inputs auf Mobile ≥ 16px (sonst iOS-Zoom). Safe-Area via `env(safe-area-inset-*)` + `viewport-fit=cover` (fürs Capacitor-Wrapping).
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
- **Etappe E** (`etappe-e-rls-audit.sql`, Phase 2): read-only Audit-Skript, das die RLS-Isolation auf der Live-DB beweist (RLS-Status, Policy-Inventar, Lücken-Detektor, Live-Cross-User-Test mit ROLLBACK). Verändert nichts. Befund Phase-2-Start: Design sauber, keine kritischen Lücken; offene Notizen N1–N3 in der SQL-Auswertung.

## Hilfreiche Einstiegspunkte

- Default-Positionen/Routinen ändern: `supabase/etappe-c-bootstrap.sql` (greift nur für neue User).
- Berechnung Überschuss anpassen: `js/haushalt.js` → `updateHaushalt()` (Monatsrechnung-Posten werden aus `getIncome()`/`getExpenses()` + Extras gespiegelt, plus Haushalt-eigene `hh_spar` & `hh_var`).
- Monatsübertrag / Plan-Überschuss anpassen: `js/render.js` → `renderKumBox()` + `calcPlanSurplus()` (Plan = monatliche Einnahmen − Ausgaben, yearly/quarterly anteilig; Ist kommt aus `monthly_states.surplus_actual`, Differenz = Ist − Plan).
- Neuen Tab hinzufügen: `<div class="tab" onclick="showTab('name',this)">` im Topnav + `<div id="tab-name" class="page">` im Container.
- Theme-Farbe ändern: `css/base.css` → `:root` bzw. `[data-theme="light"]`.
- Auth-Flow anpassen: `js/auth.js` (`enterApp`/`leaveApp`, `screens.*` Form-Handler).
- **Supabase-JS aktualisieren**: neues UMD-Bundle laden (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<ver>/dist/umd/supabase.js`) → `js/vendor/` ablegen, alten löschen, Dateinamen im `<script>`-Tag (index.html) + Doku anpassen. Muss self-contained sein (keine `import`/`/npm`-Statements).
- **Fonts aktualisieren**: Google-`css2`-URL mit Browser-User-Agent holen (liefert woff2), nur `latin` + `latin-ext` Blöcke behalten, woff2 nach `assets/fonts/`, `url()` auf `../assets/fonts/<datei>` umschreiben → `css/fonts.css`.
- Onboarding-Overlay anpassen: `index.html` (`#onboarding-overlay`) + `js/auth.js` (`maybeShowOnboarding`/`dismissOnboarding`, getriggert in `enterApp` nach dem ersten erfolgreichen Login).
- Konto-Modal / Account-Löschung: `index.html` (`#account-modal`) + `js/auth.js` (Modal-Handler + `supabase.functions.invoke("delete-account")`).

---

## Roadmap zum App-Store-Launch

Ziel: Web-App + native iOS/Android-App so schnell wie seriös möglich live, dann monetarisieren.
Stack-Entscheidung für die App: **Capacitor** — verpackt die bestehende Vanilla-HTML/CSS/JS-App in echte iOS/Android-Apps. Eine Codebasis, kein Rewrite, kein Framework (passt zu „Vanilla bleibt").

| Phase | Ziel (warum) | Kern-Schritte | Aufwand | Status |
|---|---|---|---|---|
| **1 — Fundament** | Multi-User-Basis | Supabase, Auth, RLS, 4 Tabs | — | ✅ erledigt |
| **2 — Web-App härten** | Vom Prototyp zum stabilen Produkt | **RLS-Audit** (User A darf nie Daten von User B sehen) · Account-Löschung in-App (Apple-Pflicht) · Error-Handling · Empty-State/Onboarding · Mobile-Layout · CDN-Imports lokal ins Projekt holen | ~2–3 Wo | ✅ erledigt (Tests bestanden) |
| **2.5 — Go-Live (Staging)** | Live-URL als Voraussetzung für Phase 3+4 | Deployment auf Hostinger (`akradev.de`) via Git-Deploy · `config.js` auf Server · Supabase Auth-URLs (Site URL + Redirects) auf Produktions-Domain · HTTPS/SSL · Edge Function live | ~1–2 Tage | in Arbeit |
| **3 — Recht & Landing** | Pflicht vor Veröffentlichung | Impressum · Datenschutz (DSGVO) · AGB · Support-URL · Landingpage | ~1 Wo | offen |
| **4 — Closed Beta** | Validieren *bevor* App-Aufwand entsteht | 5–10 echte Tester · Feedback · Bugfixing | ~2–3 Wo (parallel) | offen |
| **5 — Native Wrapping** | Beide Stores aus einer Codebasis | Capacitor einrichten · Android-Build (PC) · iOS-Build (Mac) · Test auf echten Geräten · Icon/Splash | ~1–2 Wo | offen |
| **6 — Store-Launch** | Live in Play Store + App Store | Developer-Accounts (Google + Apple) · Store-Assets/Screenshots · Datensicherheits-/Privacy-Formulare · Einreichung · Review-Runden | ~2–4 Wo | offen |
| **7 — Monetarisierung** | Freemium scharf schalten | Free/Pro-Grenze · In-App-Abo bzw. Affiliate | laufend | offen |

**Realistische Gesamtdauer bis live:** ~2–3 Monate bei ~8–12 h/Woche. Engpässe sind nicht der Code, sondern Apples Review (Finanz-Apps werden extra geprüft, Rejection-Runden einplanen) und der Rechts-Unterbau.

**Grundregel:** In den Store kommen ≠ Geld verdienen. Phase 4 (echte Tester) steht bewusst VOR dem App-Aufwand. Erst validieren, dann verpacken.

**Plattform-Strategie:** Aktuell kein eigener Mac. Geplant: **Mac wird in Phase 5 angeschafft** (iOS-Builds gehen nur auf macOS/Xcode). Damit laufen beide Stores parallel über denselben Capacitor-Code — Android-Build auf dem PC, iOS-Build auf dem Mac. Cloud-Build-Dienste (z. B. Codemagic) bleiben als Fallback notiert, sind aber bei eigenem Mac nicht nötig.

## Kostenübersicht

Heute (Phase 1–4): **0 €.**

### Pflicht bis Launch

| Posten | Typ | Kosten | Phase |
|---|---|---|---|
| Apple Developer Program | jährlich | ~99 €/Jahr | 6 |
| Google Play Developer | einmalig | ~25 € | 6 |
| Domain (.de/.com) | jährlich | ~10–15 €/Jahr | 3 |
| Mac für iOS-Builds | einmalig (Phase 5) | ab ~700 € (Mac mini), geplant zur Build-Phase | 5 |

⚠️ **iOS-Builds gehen NUR auf einem Mac** (Xcode = macOS only). Android baut auf dem PC. Mac wird in Phase 5 angeschafft.
**Minimum bis live ≈ 136 €/Jahr** (Apple + Google + Domain) + **einmalig ab ~700 € Mac** (Phase 5).

### Läuft mit dem Wachstum (erst bei echten Nutzern)

| Posten | Kosten | Wann |
|---|---|---|
| Supabase Pro | ~23 €/Mo | erst wenn Free-Tier-Limits (500 MB DB / Auth) reißen |
| Store-Provision | 15 % vom Umsatz (Small-Business-Programm) | sobald jemand zahlt |
| Stripe (Web-Abo, optional) | ~1,5 % + 0,25 €/Transaktion | falls Verkauf auch über Website |

### Optional

- Datenschutz/Impressum/AGB: Generator 0–250 € einmalig, oder anwaltlich geprüft 300–800 €.

## Rechtlicher Hinweis (BaFin)

Solange die App ein reiner **Tracker** ist und Finanztipps **allgemein** formuliert sind → i. d. R. außerhalb der BaFin-Regulierung. Sobald **personalisierte Anlageempfehlungen** gegeben oder **Zahlungen abgewickelt** werden → regulatorisch heikel. Tipps deshalb immer kennzeichnen als „allgemeine Info, keine Anlageberatung".
