/* ============================================================
   AUTH — Login / Register / Email-Verify / Password-Reset
   ============================================================
   ES-Modul. Wird nach supabase-client.js geladen.

   Wechselt die Body-Klasse zwischen:
     - fc-auth-loading    (initial, bis Session aufgelöst ist)
     - fc-auth-signed-out (Auth-Gate sichtbar)
     - fc-auth-signed-in  (App sichtbar)

   Recovery-Flow: Wenn der Page-Load mit ?/#type=recovery passiert,
   wird der Reset-Password-Screen erzwungen, auch wenn Supabase
   den User vorübergehend als „eingeloggt" markiert.
   ============================================================ */

import { supabase } from "./supabase-client.js";

/* --- Recovery-Token VOR allem anderen snapshotten ---
   Supabase entfernt den Hash asynchron nach dem Parsen, deshalb
   müssen wir ihn so früh wie möglich festhalten. */
const recoveryFromUrl =
  (window.location.hash || "").includes("type=recovery") ||
  new URLSearchParams(window.location.search).get("type") === "recovery";

let isRecoveryFlow = recoveryFromUrl;

const body = document.body;
const screens = {
  login:         document.getElementById("auth-screen-login"),
  register:      document.getElementById("auth-screen-register"),
  verify:        document.getElementById("auth-screen-verify"),
  forgot:        document.getElementById("auth-screen-forgot"),
  "forgot-sent": document.getElementById("auth-screen-forgot-sent"),
  reset:         document.getElementById("auth-screen-reset"),
};
const tagline = document.getElementById("auth-tagline");
const taglines = {
  login:         "Anmeldung",
  register:      "Registrierung",
  verify:        "Bestätigung",
  forgot:        "Passwort vergessen",
  "forgot-sent": "Passwort vergessen",
  reset:         "Neues Passwort",
};

/* --- Helpers --- */
function setBodyState(state) {
  body.classList.remove("fc-auth-loading", "fc-auth-signed-out", "fc-auth-signed-in");
  body.classList.add("fc-auth-" + state);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle("active", key === name);
  });
  if (tagline && taglines[name]) tagline.textContent = taglines[name];
  document.querySelectorAll("#auth-gate [data-error-slot]").forEach((slot) => {
    slot.classList.remove("visible");
    slot.textContent = "";
  });
}

function showError(form, message) {
  const slot = form.querySelector("[data-error-slot]");
  if (!slot) return;
  slot.textContent = message;
  slot.classList.add("visible");
}

function clearError(form) {
  const slot = form.querySelector("[data-error-slot]");
  if (!slot) return;
  slot.classList.remove("visible");
  slot.textContent = "";
}

function setUserEmail(email) {
  const el = document.getElementById("user-email");
  if (el) el.textContent = email || "";
}

/* Wandelt Supabase-Fehler in deutsche, freundliche Texte. */
function germanError(error) {
  if (!error) return "Etwas ist schiefgelaufen.";
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Email oder Passwort stimmt nicht.";
  if (msg.includes("email not confirmed"))       return "Bitte bestätige zuerst deine Email.";
  if (msg.includes("user already registered"))   return "Mit dieser Email gibt es schon ein Konto.";
  if (msg.includes("password should be at least")) return "Passwort muss mindestens 8 Zeichen lang sein.";
  if (msg.includes("rate limit"))                return "Zu viele Versuche. Bitte warte einen Moment.";
  if (msg.includes("invalid email"))             return "Diese Email-Adresse sieht nicht gültig aus.";
  if (msg.includes("network"))                   return "Keine Verbindung zum Server.";
  return error.message || "Etwas ist schiefgelaufen.";
}

async function withLoading(form, label, fn) {
  const btn = form.querySelector(".auth-submit");
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

/* --- Helper: Daten laden + UI in App-Modus schalten ---
   Wenn irgendwas in der Bootstrap-Kette knallt (Cache-Stand,
   defekte Supabase-Antwort, Supabase-Outage, eingefrorenes
   Free-Tier-Projekt), gibt es einen Timeout. Danach wird der
   User explizit auf den Login zurückgeworfen — nie wieder ein
   endloser Spinner.

   Dedup-Schutz: Es gibt zwei Einstiegspunkte (initialer
   getSession()-Call + onAuthStateChange-Handler). Ohne Schutz
   würden beide enterApp parallel ausführen — Race-Condition,
   die im Fehlerfall einen „Login-flash → App-mit-leerem-Cache"-
   Effekt produziert hat. _enteredUserId hält fest, für welchen
   User wir den Bootstrap bereits laufen lassen. */
const BOOTSTRAP_TIMEOUT_MS = 90000;
let _enteredUserId = null;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label}: Timeout nach ${ms} ms — Supabase antwortet nicht`)),
        ms,
      ),
    ),
  ]);
}

async function enterApp(session) {
  if (_enteredUserId === session.user.id) {
    console.log("[auth] enterApp dedup — schon eingeloggt für", session.user.email);
    return;
  }
  _enteredUserId = session.user.id;
  /* Hint nach 5s einblenden, damit der User weiß, dass Supabase
     gerade aus dem Free-Tier-Schlaf aufwacht — kann bis zu 60s
     dauern beim allerersten Request. */
  const hintEl = document.getElementById("auth-loading-hint");
  if (hintEl) hintEl.style.display = "none";
  const hintTimer = setTimeout(() => {
    if (hintEl) hintEl.style.display = "block";
  }, 5000);
  try {
    setUserEmail(session.user.email);
    if (typeof window.stateBootstrap !== "function") {
      throw new Error(
        "stateBootstrap nicht verfügbar — state.js veraltet im Cache. Strg+Shift+R, dann nochmal.",
      );
    }
    const ok = await withTimeout(
      window.stateBootstrap(session.user.id),
      BOOTSTRAP_TIMEOUT_MS,
      "Datenladen",
    );
    if (!ok) {
      throw new Error("Bootstrap fehlgeschlagen — siehe Konsole");
    }
    clearTimeout(hintTimer);
    if (typeof window.fcRenderAll === "function") window.fcRenderAll();
    setBodyState("signed-in");
    maybeShowOnboarding(session.user.id);
  } catch (e) {
    clearTimeout(hintTimer);
    console.error("[auth] enterApp failed:", e);
    showAuthError(
      (e.message || "Daten konnten nicht geladen werden") +
        " — bitte neu laden oder erneut einloggen.",
    );
    _enteredUserId = null;
    /* Wichtig: KEIN signOut() hier — das würde verzögert ein
       SIGNED_OUT-Event feuern, das den nächsten frischen Login
       teardown'd (Race-Condition). Session bleibt in localStorage,
       der nächste Reload oder Login-Submit triggert einen neuen
       Bootstrap-Versuch. */
    if (typeof window.stateTeardown === "function") window.stateTeardown();
    setBodyState("signed-out");
    showScreen("login");
  }
}

/* Fehler über das Auth-Gate sichtbar machen — der Logout-Toast wäre
   versteckt, weil die Topbar im signed-out-State unsichtbar ist.
   Bietet zusätzlich einen Retry-Link, der die Seite neu lädt — bei
   transienten Supabase-Hängern (Cold-Start o.ä.) reicht das meist. */
function showAuthError(msg) {
  const loginForm = screens.login;
  if (!loginForm) return;
  const slot = loginForm.querySelector("[data-error-slot]");
  if (!slot) return;
  slot.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = msg;
  slot.appendChild(text);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "auth-error-retry";
  retry.textContent = "Erneut versuchen";
  retry.addEventListener("click", () => location.reload());
  slot.appendChild(retry);
  slot.classList.add("visible");
}

function leaveApp() {
  _enteredUserId = null;
  if (typeof window.stateTeardown === "function") window.stateTeardown();
  setBodyState("signed-out");
  showScreen("login");
}

/* --- Initialer Zustand ---
   Wartet auf den ersten getSession()-Call, entscheidet dann. */
(async () => {
  const { data } = await supabase.auth.getSession();
  if (isRecoveryFlow) {
    setBodyState("signed-out");
    showScreen("reset");
  } else if (data.session) {
    await enterApp(data.session);
  } else {
    setBodyState("signed-out");
    showScreen("login");
  }
})();

/* --- onAuthStateChange — reagiert auf alle weiteren Wechsel --- */
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    isRecoveryFlow = true;
    setBodyState("signed-out");
    showScreen("reset");
    return;
  }

  if (event === "SIGNED_OUT") {
    isRecoveryFlow = false;
    leaveApp();
    return;
  }

  if (event === "SIGNED_IN" && session) {
    if (isRecoveryFlow) {
      setBodyState("signed-out");
      showScreen("reset");
      return;
    }
    await enterApp(session);
    return;
  }
});

/* --- Screen-Navigation (data-go-Buttons) --- */
document.querySelectorAll("#auth-gate [data-go]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.go));
});

/* --- Login --- */
screens.login.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearError(form);
  const email = form.email.value.trim();
  const password = form.password.value;
  await withLoading(form, "Anmelden …", async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showError(form, germanError(error));
  });
});

/* --- Register --- */
screens.register.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearError(form);
  const email = form.email.value.trim();
  const password = form.password.value;
  await withLoading(form, "Wird erstellt …", async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      showError(form, germanError(error));
      return;
    }
    /* Wenn Email-Confirmation in Supabase aktiv ist (Default), gibt's
       hier KEINE Session zurück — User muss erst den Link bestätigen. */
    document.getElementById("auth-verify-email").textContent = email;
    showScreen("verify");
  });
});

/* --- Forgot Password --- */
screens.forgot.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearError(form);
  const email = form.email.value.trim();
  await withLoading(form, "Sende …", async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) {
      showError(form, germanError(error));
      return;
    }
    showScreen("forgot-sent");
  });
});

/* --- Reset Password (Recovery-Flow) --- */
screens.reset.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearError(form);
  const password = form.password.value;
  await withLoading(form, "Speichere …", async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showError(form, germanError(error));
      return;
    }
    isRecoveryFlow = false;
    /* URL säubern (Hash könnte noch reste enthalten) */
    history.replaceState(null, "", window.location.pathname + window.location.search);
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setBodyState("signed-in");
      setUserEmail(data.session.user.email);
    } else {
      showScreen("login");
    }
  });
});

/* --- Logout --- */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    /* onAuthStateChange schaltet auf signed-out + Login-Screen */
  });
}

/* ============================================================
   KONTO-MODAL + Account-Löschung
   ============================================================
   Die eigentliche Löschung läuft serverseitig in der Edge
   Function „delete-account" (service_role bleibt im Backend).
   Der Client schickt nur sein JWT mit; die Function leitet die
   user.id daraus ab — eine fremde id ist nicht erzwingbar. */
const DELETE_CONFIRM_WORD = "LÖSCHEN";
const accountModal       = document.getElementById("account-modal");
const accountModalEmail  = document.getElementById("account-modal-email");
const accountModalClose  = document.getElementById("account-modal-close");
const userChip           = document.getElementById("user-chip");
const deleteConfirmInput = document.getElementById("account-delete-confirm");
const deleteBtn          = document.getElementById("account-delete-btn");
const deleteError        = document.getElementById("account-delete-error");

function openAccountModal() {
  if (!accountModal) return;
  if (accountModalEmail) {
    const el = document.getElementById("user-email");
    accountModalEmail.textContent = el ? el.textContent : "";
  }
  if (deleteConfirmInput) deleteConfirmInput.value = "";
  if (deleteError) deleteError.textContent = "";
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Konto endgültig löschen";
  }
  accountModal.classList.add("open");
  accountModal.setAttribute("aria-hidden", "false");
}

function closeAccountModal() {
  if (!accountModal) return;
  accountModal.classList.remove("open");
  accountModal.setAttribute("aria-hidden", "true");
}

if (userChip) userChip.addEventListener("click", openAccountModal);
if (accountModalClose) accountModalClose.addEventListener("click", closeAccountModal);
if (accountModal) {
  accountModal.addEventListener("click", (e) => {
    if (e.target === accountModal) closeAccountModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && accountModal?.classList.contains("open")) {
    closeAccountModal();
  }
});

/* Lösch-Button erst freischalten, wenn das Bestätigungswort exakt passt. */
if (deleteConfirmInput && deleteBtn) {
  deleteConfirmInput.addEventListener("input", () => {
    deleteBtn.disabled =
      deleteConfirmInput.value.trim().toUpperCase() !== DELETE_CONFIRM_WORD;
  });
}

/* ============================================================
   ONBOARDING — einmaliges Willkommens-Overlay
   ============================================================
   Pro Account einmal (localStorage-Flag mit User-ID). Bewusst
   per-Device: ein neuer Browser zeigt die Intro erneut — als
   UI-Nicety völlig ok, kein kritischer State (vgl. fc-theme). */
const onboardingOverlay = document.getElementById("onboarding-overlay");
const onboardingStart   = document.getElementById("onboarding-start");

function _onboardingKey(userId) {
  return "fc-onboarded-" + userId;
}

function maybeShowOnboarding(userId) {
  if (!onboardingOverlay || !userId) return;
  try {
    if (localStorage.getItem(_onboardingKey(userId))) return;
  } catch (_) {
    /* localStorage gesperrt (Privatmodus) — dann zeigen wir es halt. */
  }
  onboardingOverlay.dataset.userId = userId;
  onboardingOverlay.classList.add("open");
  onboardingOverlay.setAttribute("aria-hidden", "false");
}

function dismissOnboarding() {
  if (!onboardingOverlay) return;
  const userId = onboardingOverlay.dataset.userId;
  if (userId) {
    try {
      localStorage.setItem(_onboardingKey(userId), "1");
    } catch (_) {
      /* ignoriert — dann erscheint es beim nächsten Login wieder. */
    }
  }
  onboardingOverlay.classList.remove("open");
  onboardingOverlay.setAttribute("aria-hidden", "true");
}

if (onboardingStart) onboardingStart.addEventListener("click", dismissOnboarding);

if (deleteBtn) {
  deleteBtn.addEventListener("click", async () => {
    if (deleteConfirmInput.value.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Wird gelöscht …";
    if (deleteError) deleteError.textContent = "";

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error || !data?.success) {
        throw new Error(
          error?.message || data?.error || "Konto konnte nicht gelöscht werden",
        );
      }
      /* Lokal abmelden (kein Server-Call nötig — User existiert nicht mehr).
         SIGNED_OUT-Event triggert leaveApp() → Login-Screen. */
      await supabase.auth.signOut({ scope: "local" });
      closeAccountModal();
      if (typeof window.showToast === "function") {
        window.showToast("Konto gelöscht. Alles Gute! 👋");
      }
    } catch (e) {
      console.error("[auth] Account-Löschung fehlgeschlagen:", e);
      if (deleteError) {
        deleteError.textContent =
          "Löschung fehlgeschlagen — bitte später erneut versuchen.";
      }
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Konto endgültig löschen";
    }
  });
}
