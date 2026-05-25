-- =============================================================================
-- Finanz-Cockpit · Etappe C: Signup-Bootstrap-Trigger
-- =============================================================================
-- Voraussetzung: Etappen A + B erfolgreich gelaufen (Tabellen + RLS-Policies).
--
-- Ausführung: Supabase SQL Editor → New query → Inhalt einfügen → Run
-- Erwartetes Ergebnis: "Success. No rows returned."
--
-- Effekt: Sobald sich ein User registriert (INSERT auf auth.users),
--         werden automatisch angelegt:
--           - 1 Profile-Zeile
--           - 1 Household-Zeile (mit Defaults)
--           - 1 User-Preferences-Zeile
--           - 3 Default-Einnahmen (Gehalt, Nebenjob, Sonstiges)
--           - 4 Default-Ausgaben (Miete, Strom, Internet, Streaming-Abo)
--           - 7 Default-Routinen
--
-- Idempotent: DROP TRIGGER + CREATE OR REPLACE FUNCTION — gefahrlos re-runnable.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Bootstrap-Funktion
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: läuft als Funktions-Owner (postgres), nicht als der neue
-- User — sonst würde RLS den Bootstrap blockieren (User hat noch keine Profile-
-- Zeile und damit noch keine Berechtigung auf positions etc.).
-- SET search_path = public: Schutz gegen Search-Path-Injection.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Trigger auf auth.users
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;

-- =============================================================================
-- Verifikation 1: Funktion + Trigger existieren?
-- =============================================================================
-- SELECT tgname, tgrelid::regclass, tgenabled
-- FROM pg_trigger
-- WHERE tgname = 'on_auth_user_created';
--
-- Erwartung: 1 Zeile, tgrelid = 'auth.users', tgenabled = 'O' (origin/enabled)
-- =============================================================================

-- =============================================================================
-- Verifikation 2: Test-User anlegen (siehe nächster Schritt im Chat).
-- Nach Anlage sollten in profiles/household/user_preferences je 1 Zeile,
-- in positions 7 Zeilen, in routines 7 Zeilen erscheinen.
-- =============================================================================
