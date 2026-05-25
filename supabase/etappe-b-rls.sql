-- =============================================================================
-- Finanz-Cockpit · Etappe B: Row-Level-Security Policies
-- =============================================================================
-- Voraussetzung: Etappe A erfolgreich gelaufen, alle 9 Tabellen existieren
--                und haben RLS aktiviert (aber noch keine Policies).
--
-- Ausführung: Supabase SQL Editor → New query → Inhalt einfügen → Run
-- Erwartetes Ergebnis: "Success. No rows returned."
--
-- Effekt: Jeder authentifizierte User sieht/schreibt NUR seine eigenen Daten.
--         Nicht-authentifizierte Clients (anon) sehen weiterhin nichts.
--
-- Hinweis: Das Script ist idempotent — DROP POLICY IF EXISTS vor jedem
--          CREATE POLICY. Du kannst es bedenkenlos mehrfach laufen lassen.
-- =============================================================================

BEGIN;

-- Sicherheitsnetz: RLS aktivieren (no-op wenn schon aktiv aus Etappe A)
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_off_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_states       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips_state           ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- profiles — PK ist user.id direkt, also auth.uid() = id
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_owner_full" ON public.profiles;
CREATE POLICY "profiles_owner_full"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- household — PK ist user_id
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "household_owner_full" ON public.household;
CREATE POLICY "household_owner_full"
  ON public.household FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- user_preferences
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_preferences_owner_full" ON public.user_preferences;
CREATE POLICY "user_preferences_owner_full"
  ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- positions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "positions_owner_full" ON public.positions;
CREATE POLICY "positions_owner_full"
  ON public.positions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- one_off_entries
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "one_off_owner_full" ON public.one_off_entries;
CREATE POLICY "one_off_owner_full"
  ON public.one_off_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- monthly_states
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "monthly_states_owner_full" ON public.monthly_states;
CREATE POLICY "monthly_states_owner_full"
  ON public.monthly_states FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- routines
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "routines_owner_full" ON public.routines;
CREATE POLICY "routines_owner_full"
  ON public.routines FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- household_snapshots
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "household_snapshots_owner_full" ON public.household_snapshots;
CREATE POLICY "household_snapshots_owner_full"
  ON public.household_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- tips_state
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tips_state_owner_full" ON public.tips_state;
CREATE POLICY "tips_state_owner_full"
  ON public.tips_state FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;

-- =============================================================================
-- Verifikation: nach Ausführung folgendes Query laufen lassen.
-- Erwartetes Ergebnis: 9 Zeilen, eine Policy pro Tabelle.
-- =============================================================================
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- =============================================================================
