-- =============================================================================
-- Finanz-Cockpit · Etappe E: RLS-Audit (Verifikation der Isolation)
-- =============================================================================
-- Zweck: BEWEISEN, dass die Row-Level-Security wasserdicht ist —
--        User A darf unter keinen Umständen Daten von User B sehen oder ändern.
--
-- Ausführung: Supabase SQL Editor → New query → kompletten Inhalt einfügen → Run.
-- Das Skript ist READ-ONLY: Teil 4 läuft in einer Transaktion mit ROLLBACK,
-- es bleiben KEINE Testdaten zurück und es wird NICHTS verändert.
--
-- Lies die Ergebnisse von oben nach unten. Jeder Teil sagt, was „bestanden"
-- bedeutet. Wenn alle vier Teile passen, ist die Mandanten-Trennung bewiesen.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TEIL 1 — Ist RLS auf jeder public-Tabelle aktiviert?
-- -----------------------------------------------------------------------------
-- Erwartung: 9 Zeilen, alle mit rls_enabled = true.
-- Eine Tabelle ohne rls_enabled = true ist ein KRITISCHES Leck.
-- -----------------------------------------------------------------------------
SELECT
  c.relname                       AS tabelle,
  c.relrowsecurity                AS rls_enabled,
  c.relforcerowsecurity           AS rls_forced   -- false ist ok (s. CLAUDE.md N3)
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- TEIL 2 — Welche Policies existieren, und wie sind sie geschnitten?
-- -----------------------------------------------------------------------------
-- Erwartung: pro Tabelle eine Policy, cmd = ALL, roles = {authenticated},
-- qual (USING) UND with_check gefüllt mit „auth.uid() = user_id" (bzw. = id
-- bei profiles). Eine Policy mit roles = {public} oder leerem with_check
-- wäre verdächtig.
-- -----------------------------------------------------------------------------
SELECT
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual        AS using_ausdruck,
  p.with_check  AS with_check_ausdruck
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;


-- -----------------------------------------------------------------------------
-- TEIL 3 — Lücken-Detektor (sollte 0 Zeilen liefern)
-- -----------------------------------------------------------------------------
-- Findet (a) Tabellen ohne RLS und (b) Tabellen mit RLS, aber OHNE Policy.
-- Fall (b) ist tückisch: die Tabelle ist dann komplett dicht (auch für den
-- Owner-User), Daten „verschwinden" im Frontend. Beide Fälle = Befund.
-- Erwartung: „Success. No rows returned." / leeres Ergebnis.
-- -----------------------------------------------------------------------------
SELECT c.relname AS tabelle, 'RLS NICHT aktiviert' AS problem
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
UNION ALL
SELECT c.relname, 'RLS aktiv, aber KEINE Policy (Tabelle komplett gesperrt)'
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY tabelle;


-- -----------------------------------------------------------------------------
-- TEIL 4 — Live-Isolations-Test (der eigentliche Beweis)
-- -----------------------------------------------------------------------------
-- Schlüpft in die Rolle „authenticated" und gibt sich per JWT-Claim als
-- User A aus. Dann wird geprüft, wie viele Zeilen User A sieht — und ob er
-- AUCH NUR EINE Zeile von User B sehen kann (muss 0 sein).
--
-- Voraussetzung: mindestens 2 registrierte User. Bei < 2 Usern überspringt
-- der Block den Test mit einem Hinweis (lege ggf. 2 Test-User über die
-- App an und lass den Test erneut laufen).
--
-- Alles läuft in BEGIN … ROLLBACK → keine Daten werden verändert.
-- Erwartung pro Tabelle: *_von_B_sichtbar = 0  → BESTANDEN.
-- -----------------------------------------------------------------------------
BEGIN;

-- Zwei verschiedene User auswählen (ältester = A, nächster = B)
SELECT set_config('audit.user_a',
  (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), true);
SELECT set_config('audit.user_b',
  (SELECT id::text FROM auth.users
   WHERE id::text <> current_setting('audit.user_a', true)
   ORDER BY created_at LIMIT 1), true);

-- Hinweis ausgeben, falls < 2 User vorhanden sind
SELECT CASE
  WHEN current_setting('audit.user_b', true) IS NULL
    OR current_setting('audit.user_b', true) = ''
  THEN 'ÜBERSPRUNGEN — es sind weniger als 2 User registriert. '
       || 'Lege 2 Test-User an und führe Teil 4 erneut aus.'
  ELSE 'OK — Test läuft mit User A = ' || current_setting('audit.user_a', true)
       || ' und User B = ' || current_setting('audit.user_b', true)
END AS teil4_status;

-- Ab hier als authenticated-User A agieren
SELECT set_config('request.jwt.claims',
  json_build_object(
    'sub',  current_setting('audit.user_a', true),
    'role', 'authenticated'
  )::text, true);
SET LOCAL role authenticated;

-- Sichtbarkeit aus Sicht von User A.
-- *_sichtbar          = wie viele Zeilen A insgesamt sieht (= nur A's eigene)
-- *_von_B_sichtbar    = wie viele davon B gehören  → MUSS 0 SEIN
SELECT 'household'        AS tabelle,
       count(*)          AS sichtbar,
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) AS von_B_sichtbar
FROM household
UNION ALL
SELECT 'positions',       count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM positions
UNION ALL
SELECT 'one_off_entries', count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM one_off_entries
UNION ALL
SELECT 'monthly_states',  count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM monthly_states
UNION ALL
SELECT 'routines',        count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM routines
UNION ALL
SELECT 'tips_state',      count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM tips_state
UNION ALL
SELECT 'user_preferences', count(*),
       count(*) FILTER (WHERE user_id::text = current_setting('audit.user_b', true)) FROM user_preferences
UNION ALL
SELECT 'profiles',        count(*),
       count(*) FILTER (WHERE id::text = current_setting('audit.user_b', true)) FROM profiles
ORDER BY tabelle;

-- Gegen-Test: Darf User A eine Zeile von User B SCHREIBEN? (muss 0 Treffer geben)
-- Wir versuchen ein UPDATE auf B's household — WITH CHECK/USING müssen es
-- auf 0 betroffene Zeilen begrenzen.
WITH versuch AS (
  UPDATE household
  SET bargeld = bargeld + 1
  WHERE user_id::text = current_setting('audit.user_b', true)
  RETURNING 1
)
SELECT count(*) AS fremde_zeilen_geaendert  -- MUSS 0 SEIN
FROM versuch;

RESET role;
ROLLBACK;

-- =============================================================================
-- AUSWERTUNG
-- =============================================================================
-- Teil 1: alle rls_enabled = true?                     → ja  = bestanden
-- Teil 2: pro Tabelle eine ALL-Policy, roles=authenticated, beide Ausdrücke
--         auf auth.uid()?                               → ja  = bestanden
-- Teil 3: leeres Ergebnis?                              → ja  = bestanden
-- Teil 4: jede Zeile von_B_sichtbar = 0
--         UND fremde_zeilen_geaendert = 0?              → ja  = ISOLATION BEWIESEN
-- =============================================================================
