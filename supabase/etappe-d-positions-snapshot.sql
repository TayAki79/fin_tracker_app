-- ============================================================
-- ETAPPE D — positions_snapshot in monthly_states
-- ============================================================
-- Friert die Positionen (Bezeichnungen + Beträge der wiederkehrenden
-- Einnahmen/Ausgaben) ein, wie sie zum Zeitpunkt des ersten Schreibens
-- in einen Monat ausgesehen haben.
--
-- Wofür: damit historische Monate auch nach späteren Umbenennungen
-- oder Betragsänderungen den korrekten damaligen Zustand zeigen können.
-- Die UI nutzt das (noch) nicht — der Snapshot wird jetzt nur erfasst.
-- ============================================================

ALTER TABLE public.monthly_states
ADD COLUMN IF NOT EXISTS positions_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.monthly_states.positions_snapshot IS
  'Eingefrorener Schnappschuss der Positionen bei erstem Schreiben in diesen Monat. '
  'Form: { "<position_id>": { "name": text, "amount": number, "kind": "income"|"expense", '
  '"day": text, "category": text, "yearly": bool, "quarterly": bool } }. '
  'Wird vom Frontend beim ersten Insert befüllt und danach nicht mehr verändert.';
