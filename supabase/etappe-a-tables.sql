-- =============================================================================
-- Finanz-Cockpit · Etappe A: Tabellen + Indexe + Trigger
-- =============================================================================
-- Ausführung: Supabase SQL Editor → New query → kompletten Inhalt einfügen → Run
-- Erwartetes Ergebnis: "Success. No rows returned."
-- Nach Ausführung: 9 Tabellen im Table Editor sichtbar (siehe Verifikation unten).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helper-Funktion: automatisches updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles — Pro-User-Metadaten
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. household — Aktuelle Vermögens-/Haushalts-Werte (1:1)
-- -----------------------------------------------------------------------------
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
  kredit_zins      numeric(6,3)  NOT NULL DEFAULT 0,
  updated_at       timestamptz   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tg_household_updated_at
BEFORE UPDATE ON public.household
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. user_preferences — Theme, Klapp-Zustände
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_preferences (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme            text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  collapsed_boxes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tg_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. positions — Wiederkehrende Einnahmen + Ausgaben
-- -----------------------------------------------------------------------------
CREATE TABLE public.positions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('income', 'expense')),
  name         text NOT NULL,
  slug         text,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  day          text,
  category     text,
  yearly       boolean NOT NULL DEFAULT false,
  quarterly    boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  archived_at  timestamptz
);

CREATE INDEX idx_positions_user_kind
  ON public.positions (user_id, kind)
  WHERE archived_at IS NULL;

CREATE TRIGGER tg_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. one_off_entries — Pro-Monat-Einmaleinträge (Extras)
-- -----------------------------------------------------------------------------
CREATE TABLE public.one_off_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year        int  NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month       int  NOT NULL CHECK (month BETWEEN 0 AND 11),
  kind        text NOT NULL CHECK (kind IN ('income', 'expense')),
  name        text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_one_off_user_month
  ON public.one_off_entries (user_id, year, month);

-- -----------------------------------------------------------------------------
-- 7. monthly_states — Häkchen, Notiz, Überschuss pro Monat
-- -----------------------------------------------------------------------------
CREATE TABLE public.monthly_states (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year            int  NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month           int  NOT NULL CHECK (month BETWEEN 0 AND 11),
  income_paid     jsonb NOT NULL DEFAULT '{}'::jsonb,
  expense_paid    jsonb NOT NULL DEFAULT '{}'::jsonb,
  routine_done    jsonb NOT NULL DEFAULT '{}'::jsonb,
  surplus_actual  numeric(12,2),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX idx_monthly_states_user
  ON public.monthly_states (user_id, year, month);

CREATE TRIGGER tg_monthly_states_updated_at
BEFORE UPDATE ON public.monthly_states
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. routines — Default + Custom-Routinen
-- -----------------------------------------------------------------------------
CREATE TABLE public.routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day          text NOT NULL,
  title        text NOT NULL,
  description  text,
  sort_order   int  NOT NULL DEFAULT 0,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  archived_at  timestamptz
);

CREATE INDEX idx_routines_user
  ON public.routines (user_id)
  WHERE archived_at IS NULL;

CREATE TRIGGER tg_routines_updated_at
BEFORE UPDATE ON public.routines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. household_snapshots — Time-Series für Gamification
-- -----------------------------------------------------------------------------
CREATE TABLE public.household_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year        int  NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month       int  NOT NULL CHECK (month BETWEEN 0 AND 11),
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX idx_household_snapshots_user
  ON public.household_snapshots (user_id, year, month);

-- -----------------------------------------------------------------------------
-- 10. tips_state — Finanztipps-Status pro User
-- -----------------------------------------------------------------------------
CREATE TABLE public.tips_state (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tip_id      text NOT NULL,
  status      text NOT NULL CHECK (status IN ('dismissed', 'accepted')),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tip_id)
);

CREATE TRIGGER tg_tips_state_updated_at
BEFORE UPDATE ON public.tips_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. Row-Level-Security aktivieren (Policies kommen in Etappe B)
--     Bis Etappe B läuft sind alle Tabellen für ALLE Clients gesperrt.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_off_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_states       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips_state           ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- Verifikation: nach Ausführung folgendes Query laufen lassen.
-- Erwartetes Ergebnis: 9 Zeilen
-- =============================================================================
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
--
-- Erwartung:
--   household
--   household_snapshots
--   monthly_states
--   one_off_entries
--   positions
--   profiles
--   routines
--   tips_state
--   user_preferences
-- =============================================================================
