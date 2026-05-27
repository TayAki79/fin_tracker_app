# Supabase Datenmodell — Finanz-Cockpit

**Status:** Entwurf, Phase 1 · letzte Aktualisierung: 2026-05-25

Dieses Dokument beschreibt das Datenbankschema, das wir in Supabase (PostgreSQL) anlegen. Alle SQL-Statements unten sind **direkt ausführbar** im Supabase SQL Editor — bitte in der Reihenfolge, in der sie hier stehen.

---

## 1. Designprinzipien

1. **Jeder Nutzer sieht nur seine eigenen Daten.** Row-Level-Security (RLS) ist auf jeder Tabelle aktiv, Foreign-Key auf `auth.users(id)`.
2. **`auth.users` (Supabase-managed) wird nicht angefasst.** Eigene Tabellen leben im `public`-Schema, hängen über `user_id`/`id` an `auth.users` und werden bei Account-Löschung kaskadiert mit gelöscht.
3. **Eigenschaften, die viele Zeilen wären (z.B. Häkchen), werden als `jsonb`-Spalten gespeichert** — pragmatisch für die Datenmengen (≤30 Einträge pro Monat).
4. **Monate werden lazy angelegt:** ein leerer Monat hat *keine* Zeile in `monthly_states`. Frontend rendert dann Defaults.
5. **`gen_random_uuid()` wird als ID-Generator verwendet** (Postgres 13+ built-in, in Supabase standardmäßig verfügbar).
6. **Soft-Deletes via `archived_at`** für `positions` und `routines` — damit historische Monate weiterhin auf gelöschte Posten verweisen können, ohne Daten zu verlieren.
7. **Beim Signup wird ein Bootstrap-Trigger** ausgelöst, der Profile, Household, Preferences und Default-Positionen/Routinen anlegt.

---

## 2. Tabellen-Übersicht

```
auth.users (Supabase-managed)
└── public.profiles (1:1)
    ├── public.household (1:1)
    ├── public.user_preferences (1:1)
    ├── public.positions (1:N) — Einnahmen + Fixausgaben (wiederkehrend)
    ├── public.one_off_entries (1:N) — Extras pro Monat
    ├── public.monthly_states (1:N) — Häkchen, Notiz, Überschuss pro Monat
    ├── public.routines (1:N) — Routine-Items (default + user-custom)
    ├── public.household_snapshots (1:N) — Time-Series für Gamification
    └── public.tips_state (1:N) — Finanztipps angenommen/verworfen
```

---

## 3. SQL — Schema anlegen

### 3.1 Helper-Funktion für `updated_at`

```sql
-- Automatisches updated_at-Update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

### 3.2 `profiles` — Pro-User-Metadaten

Erweitert `auth.users` um Anwendungs-spezifische Felder (Premium-Tier, Locale).

```sql
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale        text NOT NULL DEFAULT 'de-DE',
  tier          text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  premium_until timestamptz,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.3 `household` — Aktuelle Vermögens-/Haushalts-Werte

Ein-Zeilen-Tabelle pro User. Diese Werte sind „Point-in-Time" — historische Verläufe leben in `household_snapshots`.

```sql
CREATE TABLE public.household (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Vermögen
  aktien           numeric(12,2) NOT NULL DEFAULT 0,
  krypto           numeric(12,2) NOT NULL DEFAULT 0,
  tagesgeld        numeric(12,2) NOT NULL DEFAULT 0,
  girokonto        numeric(12,2) NOT NULL DEFAULT 0,
  bargeld          numeric(12,2) NOT NULL DEFAULT 0,
  kredit           numeric(12,2) NOT NULL DEFAULT 0,
  -- Monatsrechnung (Haushalt-eigen)
  sparplaene       numeric(12,2) NOT NULL DEFAULT 0,
  variable_kosten  numeric(12,2) NOT NULL DEFAULT 0,
  -- Ziel Barreserve
  bar_ausgabe      numeric(12,2) NOT NULL DEFAULT 0,
  bar_ziel         numeric(12,2) NOT NULL DEFAULT 0,
  bar_sparrate     numeric(12,2) NOT NULL DEFAULT 0,
  -- Ziel Notfallkonto
  nf_aktuell       numeric(12,2) NOT NULL DEFAULT 0,
  nf_ausgabe       numeric(12,2) NOT NULL DEFAULT 0,
  nf_ziel          numeric(12,2) NOT NULL DEFAULT 0,
  nf_sparrate      numeric(12,2) NOT NULL DEFAULT 0,
  -- Kredit Details
  kredit_rate      numeric(12,2) NOT NULL DEFAULT 0,
  kredit_zins      numeric(6,3) NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tg_household_updated_at
BEFORE UPDATE ON public.household
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.4 `user_preferences` — UI-Zustand (Theme, Klapp-Zustände)

```sql
CREATE TABLE public.user_preferences (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme            text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  collapsed_boxes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tg_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.5 `positions` — Wiederkehrende Einnahmen + Ausgaben

Ersetzt `INCOME_BASE_DEF` + `EXPENSES_DEF` + `state.names` + `state.amounts` aus der localStorage-Version.

```sql
CREATE TABLE public.positions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('income', 'expense')),
  name         text NOT NULL,
  slug         text,                   -- optional, für seed defaults stable; nullable für user-eigene
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  day          text,                   -- z.B. "1.", "15." — nur income
  category     text,                   -- z.B. 'wohnen' (aus CAT) — nur expense
  yearly       boolean NOT NULL DEFAULT false,
  quarterly    boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  archived_at  timestamptz             -- soft-delete: behält Bezug in alten Monaten
);

CREATE INDEX idx_positions_user_kind ON public.positions (user_id, kind) WHERE archived_at IS NULL;

CREATE TRIGGER tg_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.6 `one_off_entries` — Pro-Monat-Einmaleinträge

Ersetzt `extraIncome` + `extraExpense` aus der localStorage-Version.

```sql
CREATE TABLE public.one_off_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year        int NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month       int NOT NULL CHECK (month BETWEEN 0 AND 11),
  kind        text NOT NULL CHECK (kind IN ('income', 'expense')),
  name        text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_one_off_user_month ON public.one_off_entries (user_id, year, month);
```

### 3.7 `monthly_states` — Pro-Monat-Zustand

Häkchen, Notizfeld, kumulierter Überschuss. Wird **lazy** angelegt — erst beim ersten Häkchen für den Monat.

```sql
CREATE TABLE public.monthly_states (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year                int NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month               int NOT NULL CHECK (month BETWEEN 0 AND 11),
  income_paid         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "<position_id>": true }
  expense_paid        jsonb NOT NULL DEFAULT '{}'::jsonb,
  routine_done        jsonb NOT NULL DEFAULT '{}'::jsonb,
  surplus_actual      numeric(12,2),                         -- user-eingetragener kumulierter Überschuss
  positions_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb,    -- eingefrorene Beträge/Namen, siehe Etappe D
  note                text,                                  -- Phase 2: Monatsnotiz
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX idx_monthly_states_user ON public.monthly_states (user_id, year, month);

CREATE TRIGGER tg_monthly_states_updated_at
BEFORE UPDATE ON public.monthly_states
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.8 `routines` — Routine-Items (default + user-custom)

```sql
CREATE TABLE public.routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day          text NOT NULL,                     -- '01.', 'Monatsmitte', 'Monatsende'
  title        text NOT NULL,
  description  text,
  sort_order   int NOT NULL DEFAULT 0,
  is_default   boolean NOT NULL DEFAULT false,    -- markiert seed-defaults (read-only Hinweis im UI optional)
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  archived_at  timestamptz
);

CREATE INDEX idx_routines_user ON public.routines (user_id) WHERE archived_at IS NULL;

CREATE TRIGGER tg_routines_updated_at
BEFORE UPDATE ON public.routines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.9 `household_snapshots` — Zeitserie für Gamification

Bei Monatsende (oder explizit per User-Aktion) wird ein Snapshot des aktuellen `household`-Zustands eingefroren. Daraus speist sich später das Etappen-Diagramm für Barreserve/Notfallkonto.

```sql
CREATE TABLE public.household_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year        int NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month       int NOT NULL CHECK (month BETWEEN 0 AND 11),
  data        jsonb NOT NULL,                  -- Snapshot der household-Zeile
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX idx_household_snapshots_user ON public.household_snapshots (user_id, year, month);
```

### 3.10 `tips_state` — Finanztipps-Status pro User

Die statischen `TIPS_DATA` aus `js/data.js` bleiben client-seitig. Diese Tabelle merkt sich nur, welcher User welchen Tipp dismissed/accepted hat.

```sql
CREATE TABLE public.tips_state (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tip_id      text NOT NULL,                     -- 't1', 't2', etc. (matched gegen TIPS_DATA)
  status      text NOT NULL CHECK (status IN ('dismissed', 'accepted')),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tip_id)
);

CREATE TRIGGER tg_tips_state_updated_at
BEFORE UPDATE ON public.tips_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## 4. Row-Level-Security-Policies

**Reihenfolge wichtig:** erst RLS aktivieren, dann Policy anlegen — sonst sind die Tabellen vorübergehend für niemanden lesbar.

```sql
-- Profile (PK = user.id)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_owner_full"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Household (PK = user_id)
ALTER TABLE public.household ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household_owner_full"
  ON public.household FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_preferences_owner_full"
  ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Positions
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_owner_full"
  ON public.positions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- One-off Entries
ALTER TABLE public.one_off_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "one_off_owner_full"
  ON public.one_off_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Monthly States
ALTER TABLE public.monthly_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_states_owner_full"
  ON public.monthly_states FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routines
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routines_owner_full"
  ON public.routines FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Household Snapshots
ALTER TABLE public.household_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household_snapshots_owner_full"
  ON public.household_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tips State
ALTER TABLE public.tips_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tips_state_owner_full"
  ON public.tips_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## 5. Signup-Bootstrap

Wenn sich ein neuer Nutzer registriert, wird **automatisch** angelegt:
- Profile-Zeile
- Household-Zeile mit Standard-Defaults
- User-Preferences-Zeile
- 3 Standard-Einnahmen (Gehalt, Nebenjob, Sonstiges)
- 4 Standard-Ausgaben (Miete, Strom, Internet, Streaming-Abo)
- 7 Standard-Routinen

Implementiert via `SECURITY DEFINER`-Funktion + Trigger auf `auth.users`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Profile
  INSERT INTO public.profiles (id) VALUES (NEW.id);

  -- Household mit Defaults
  INSERT INTO public.household (
    user_id, aktien, krypto, tagesgeld, girokonto, bargeld,
    bar_ziel, bar_sparrate, nf_ziel, nf_sparrate
  ) VALUES (
    NEW.id, 1000, 500, 500, 200, 300,
    5000, 100, 5000, 100
  );

  -- User Preferences
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);

  -- Default Income Positions
  INSERT INTO public.positions (user_id, kind, name, slug, amount, day, sort_order) VALUES
    (NEW.id, 'income',  'Gehalt',         'gehalt',    2000, '1.',  0),
    (NEW.id, 'income',  'Nebenjob',       'nebenjob',   400, '15.', 1),
    (NEW.id, 'income',  'Sonstiges',      'sonstiges',  100, '20.', 2);

  -- Default Expense Positions
  INSERT INTO public.positions (user_id, kind, name, slug, amount, category, sort_order) VALUES
    (NEW.id, 'expense', 'Miete',          'miete',      800, 'wohnen', 0),
    (NEW.id, 'expense', 'Strom',          'strom',       60, 'wohnen', 1),
    (NEW.id, 'expense', 'Internet',       'internet',    30, 'wohnen', 2),
    (NEW.id, 'expense', 'Streaming-Abo',  'streaming',   15, 'abo',    3);

  -- Default Routines
  INSERT INTO public.routines (user_id, day, title, description, sort_order, is_default) VALUES
    (NEW.id, '01.',          'Einnahmen prüfen',     'Sind alle Einnahmen (Gehalt, Nebeneinkommen, ...) auf dem Konto eingegangen?', 0, true),
    (NEW.id, '01.',          'Sparrate überweisen',  'Den festen Sparbetrag direkt auf das Sparkonto / ETF-Depot transferieren — bevor anderes ausgegeben wird.', 1, true),
    (NEW.id, '01.',          'Budget setzen',        'Variables Monatsbudget festlegen (z.B. als Bargeld entnehmen oder als Limit notieren).', 2, true),
    (NEW.id, 'Monatsmitte',  'Budget-Check',         'Wie viel vom variablen Budget ist noch übrig? Notwendige Korrekturen jetzt vornehmen.', 3, true),
    (NEW.id, 'Monatsende',   'Fixkosten prüfen',     'Wurden alle Fixkosten (Miete, Strom, Abos) korrekt abgebucht?', 4, true),
    (NEW.id, 'Monatsende',   'Überschuss verbuchen', 'Differenz aus Einnahmen und Ausgaben in die Barreserve oder Sparpläne überführen.', 5, true),
    (NEW.id, 'Monatsende',   'Nächsten Monat planen','Sonderausgaben (Versicherungen, Geschenke, Reisen) im Blick behalten.', 6, true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Warum `SECURITY DEFINER`:** der Trigger läuft als Funktions-Owner (Postgres-Admin), nicht als der gerade neu angelegte User — der hat ja noch keine Profile-Zeile und damit auch keine RLS-Berechtigung auf `positions` etc. Ohne `SECURITY DEFINER` würde der Bootstrap an der RLS scheitern.

---

## 6. Account-Löschung (DSGVO Art. 17 + Apple-Pflicht)

Wenn ein User sein Konto löschen will:

1. Frontend ruft die Supabase Auth Admin API über eine **Edge Function** (oder Backend-Route) auf:
   ```js
   await supabase.auth.admin.deleteUser(userId)
   ```
2. `ON DELETE CASCADE` auf `profiles.id` → alle Children-Tabellen werden automatisch geleert.
3. Bestätigungs-Email an den User („Dein Konto wurde gelöscht").

**Wichtig:** die Admin API ist **nicht** vom Frontend aufrufbar — sie braucht den Service-Role-Key. Wir bauen dafür eine kleine Supabase Edge Function (TypeScript, ~30 Zeilen).

Für Phase 1 OK; Soft-Delete mit 30-Tage-Grace-Period ist Phase-3-Feature.

---

## 7. Was im Frontend ändern muss (Phase 1)

Vorher (localStorage):
```js
state.amounts["inc_gehalt"]
state["2026-4"].incPaid["gehalt"]
state["2026-4"].extraIncome.push(...)
```

Nachher (Supabase):
```js
await supabase.from("positions")
  .select("*")
  .eq("user_id", userId)
  .eq("kind", "income")
  .is("archived_at", null)
  .order("sort_order")

await supabase.from("monthly_states")
  .upsert({ user_id, year, month, income_paid: { [pos.id]: true } })
  .select()
```

Alle `state.*`-Zugriffe in `js/state.js` werden zu async-Funktionen, die gegen Supabase laufen. Frontend braucht einen kleinen **Cache-Layer** (in-memory Map), damit nicht jeder Re-Render neu lädt.

Detail-Refactor kommt im nächsten Schritt.

---

## 8. Offene Entscheidungen / Phase-2-Hooks

- **Tier-Limits** für `free` vs `premium` müssen wir noch definieren (z.B. nur 12 Monate History für free). Sobald entschieden, kommen entweder Check-Constraints oder Application-Level-Checks dazu.
- **Tips-Tabelle:** `TIPS_DATA` bleibt für MVP client-side. Später kann eine `public.tips`-Tabelle her, dann sind Tipps redaktionell ohne Code-Release pflegbar.
- **Mehrere Währungen:** für MVP nicht — € hardcoded. Wenn das mal kommt, `currency`-Spalte auf `positions`, `one_off_entries`, `household`.
- **Snapshot-Strategie:** wann genau wird ein `household_snapshot` erstellt? Vorschlag: beim ersten Häkchen für einen *neuen* Folgemonat wird der Vormonat „eingefroren". Auto-Snapshot, kein User-Aufwand.

---

## 9. Ausführungs-Reihenfolge in Supabase

Im SQL Editor nacheinander:

1. Section **3.1** — Helper-Funktion
2. Section **3.2–3.10** — Tabellen + Indexe + Trigger
3. Section **4** — RLS aktivieren + Policies
4. Section **5** — Signup-Bootstrap-Funktion + Trigger
5. `supabase/etappe-d-positions-snapshot.sql` — `positions_snapshot`-Spalte in `monthly_states` (nachträglich hinzugefügt, siehe 3.7)

**Reihenfolge ist wichtig** — Children-Tabellen brauchen `profiles` zuerst, RLS braucht die Tabellen, der Bootstrap-Trigger braucht alle Tabellen.

Nach jedem Schritt im Editor prüfen: `select * from <tabelle>` sollte funktionieren (leer, aber ohne Fehler).
