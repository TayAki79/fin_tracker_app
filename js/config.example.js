/* ============================================================
   CONFIG — Supabase-Verbindungsdaten
   ============================================================
   Diese Datei ist eine Vorlage und checked-in.

   ANLEITUNG:
   1. Datei nach `js/config.js` kopieren
   2. Werte unten mit deinen echten Supabase-Credentials ersetzen
   3. `js/config.js` ist in .gitignore — wird NICHT committed

   Wo du die Werte findest:
   Supabase Dashboard → dein Projekt → Project Settings → API
     - "Project URL"            → unten als SUPABASE_URL
     - "anon public" API key    → unten als SUPABASE_ANON_KEY

   Der anon-Key darf öffentlich sein — Row-Level-Security schützt die Daten.
   Den `service_role`-Key NIEMALS hier einfügen — der gehört nur in Edge Functions.
   ============================================================ */

export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-KEY-HERE";
