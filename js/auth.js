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

/* --- Initialer Zustand ---
   Wartet auf den ersten getSession()-Call, entscheidet dann. */
(async () => {
  const { data } = await supabase.auth.getSession();
  if (isRecoveryFlow) {
    setBodyState("signed-out");
    showScreen("reset");
  } else if (data.session) {
    setBodyState("signed-in");
    setUserEmail(data.session.user.email);
  } else {
    setBodyState("signed-out");
    showScreen("login");
  }
})();

/* --- onAuthStateChange — reagiert auf alle weiteren Wechsel --- */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    isRecoveryFlow = true;
    setBodyState("signed-out");
    showScreen("reset");
    return;
  }

  if (event === "SIGNED_OUT") {
    isRecoveryFlow = false;
    setBodyState("signed-out");
    showScreen("login");
    return;
  }

  if (event === "SIGNED_IN" && session) {
    if (isRecoveryFlow) {
      setBodyState("signed-out");
      showScreen("reset");
      return;
    }
    setBodyState("signed-in");
    setUserEmail(session.user.email);
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
