/* ============================================================
   SUPABASE CLIENT — initialisiert die Verbindung zum Backend
   ============================================================
   Wird als ES-Modul geladen (siehe index.html: <script type="module">).

   Stellt den Supabase-Client als window.supabase bereit, damit die
   bestehenden Vanilla-JS-Skripte (state.js, render.js, …) drauf
   zugreifen können — ohne dass wir die alle auf ES-Module umstellen
   müssen.

   Wichtig: diese Datei MUSS über einen HTTP-Server geladen werden,
            nicht per file:// (ES-Module brauchen CORS).
            Lokal: `python -m http.server 8765`

   createClient kommt aus dem lokal eingebundenen UMD-Bundle
   (js/vendor/supabase-js@*.umd.js), das window.supabase als
   Library-Namespace setzt — geladen als klassisches Script VOR
   diesem Modul. Keine CDN-Abhängigkeit mehr zur Laufzeit.
   ============================================================ */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const _sbLib = window.supabase;
if (!_sbLib || typeof _sbLib.createClient !== "function") {
  console.error(
    "[Supabase] UMD-Bundle nicht geladen — fehlt das <script src=\"js/vendor/supabase-js@*.umd.js\"> vor den Modulen in index.html?",
  );
}
const createClient = _sbLib.createClient;

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  SUPABASE_URL.includes("YOUR-PROJECT-REF") ||
  SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY")
) {
  console.error(
    "[Supabase] config.js enthält noch Platzhalter. " +
      "Bitte echte Werte aus dem Supabase-Dashboard eintragen.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Auch global verfügbar machen für die bestehenden non-module Skripte
window.supabase = supabase;

// Mini-Self-Check fürs Debugging — Ergebnis in DevTools Console sichtbar.
(async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log(
      "[Supabase] Client bereit. Session:",
      data.session ? `eingeloggt als ${data.session.user.email}` : "keine",
    );
  } catch (e) {
    console.error("[Supabase] Verbindung fehlgeschlagen:", e);
  }
})();
