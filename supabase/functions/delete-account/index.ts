// =============================================================================
// Finanz-Cockpit · Edge Function: delete-account
// =============================================================================
// Löscht das Konto des AUFRUFENDEN Users (DSGVO + Apple-Pflicht).
//
// Sicherheitsmodell:
//   - Der service_role-Key lebt NUR hier im Function-Env, niemals im Frontend.
//   - Der Aufrufer weist sich per JWT (Authorization-Header) aus. Wir lösen
//     daraus die echte user.id auf — der Client kann KEINE fremde id angeben.
//   - admin.deleteUser(id) entfernt die Zeile aus auth.users; alle public-
//     Tabellen hängen per ON DELETE CASCADE daran und werden mitgelöscht.
//
// Deployment:
//   supabase functions deploy delete-account
// Benötigte Secrets sind in Supabase automatisch gesetzt:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error("[delete-account] Env-Secrets fehlen");
    return json({ error: "Server misconfigured" }, 500);
  }

  // 1. Aufrufer identifizieren — aus dem mitgesendeten JWT, nicht aus dem Body.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Nicht authentifiziert" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    console.warn("[delete-account] Token ungültig:", userErr?.message);
    return json({ error: "Sitzung ungültig — bitte neu einloggen" }, 401);
  }
  const userId = userData.user.id;

  // 2. Mit Admin-Rechten löschen. CASCADE räumt alle public-Tabellen ab.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("[delete-account] deleteUser failed:", delErr.message);
    return json({ error: "Konto konnte nicht gelöscht werden" }, 500);
  }

  console.log("[delete-account] Konto gelöscht:", userId);
  return json({ success: true });
});
