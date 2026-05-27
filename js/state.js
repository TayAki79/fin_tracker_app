/* ============================================================
   STATE — Supabase-backed In-Memory-Cache
   ============================================================
   Ersetzt die alte localStorage-Persistenz. API-Surface bleibt
   mit render.js / haushalt.js kompatibel (isIncPaid, getAmt,
   setName, …), damit dort möglichst wenig angefasst werden muss.

   Lifecycle:
     - stateBootstrap(userId)  → lädt alle Daten in den Cache
     - stateTeardown()         → leert den Cache (bei Logout)

   Schreib-Operationen sind optimistisch: Cache wird sofort
   aktualisiert, Supabase-Write läuft im Hintergrund. Bei Fehler
   gibt's einen Toast — Rollback nur, wo es schmerzhaft fehlt
   (z.B. neue Extras, die ohne ID nicht existieren können).
   ============================================================ */

const _cache = {
  userId: null,
  household: null,       // { aktien, krypto, tagesgeld, … }
  preferences: null,     // { theme, collapsed_boxes }
  positions: [],         // [{ id, kind, name, amount, slug, day, category, yearly, quarterly, … }]
  routines: [],          // [{ id, day, title, description, sort_order, … }]
  monthlyStates: {},     // keyed by "<year>-<month>"
  oneOffEntries: {},     // keyed by "<year>-<month>" → array
  tipsState: {},         // keyed by tip_id → 'dismissed' | 'accepted'
};
let _ready = false;

function stateIsReady() {
  return _ready;
}

/* ============================================================
   Bootstrap / Teardown
   ============================================================ */

async function stateBootstrap(userId) {
  _cache.userId = userId;
  const sb = window.supabase;
  if (!sb) {
    console.error("[state] supabase client not ready");
    return false;
  }
  console.log("[state] bootstrap start for userId:", userId);
  const t0 = performance.now();
  try {
    const [hh, prefs, pos, ms, ooe, rt, tps] = await Promise.all([
      sb.from("household").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("positions").select("*").eq("user_id", userId).is("archived_at", null).order("sort_order"),
      sb.from("monthly_states").select("*").eq("user_id", userId),
      sb.from("one_off_entries").select("*").eq("user_id", userId),
      sb.from("routines").select("*").eq("user_id", userId).is("archived_at", null).order("sort_order"),
      sb.from("tips_state").select("*").eq("user_id", userId),
    ]);
    console.log("[state] bootstrap queries done in", (performance.now() - t0).toFixed(0), "ms");

    const anyError = [hh, prefs, pos, ms, ooe, rt, tps].find((r) => r.error);
    if (anyError) {
      console.error("[state] bootstrap error:", anyError.error);
      /* PGRST303 = „JWT issued at future" — Clock-Skew zwischen
         Supabase-Services; der gecachte Token in localStorage ist
         unbrauchbar. Lokal abmelden (scope:'local' = ohne Server-
         Call, daher schnell + keine Race-Condition) und der User
         landet auf dem Login. */
      if (anyError.error?.code === "PGRST303") {
        console.warn("[state] PGRST303 — invalidating local session");
        try {
          await sb.auth.signOut({ scope: "local" });
        } catch (e) {
          console.error("[state] local signOut failed:", e);
        }
        showToast("⚠ Anmeldedaten abgelaufen — bitte neu einloggen");
        return false;
      }
      showToast("⚠ Daten konnten nicht geladen werden");
      return false;
    }

    _cache.household = hh.data || null;
    _cache.preferences = prefs.data || null;
    _cache.positions = pos.data || [];
    _cache.routines = rt.data || [];

    console.log(
      "[state] bootstrap loaded — household:", _cache.household ? "yes" : "MISSING",
      "| preferences:", _cache.preferences ? "yes" : "MISSING",
      "| positions:", _cache.positions.length,
      "| monthly_states:", (ms.data || []).length,
      "| one_off_entries:", (ooe.data || []).length,
      "| routines:", _cache.routines.length,
      "| tips_state:", (tps.data || []).length,
    );
    if (_cache.positions.length === 0) {
      console.warn("[state] WARNUNG: keine positions geladen — Supabase RLS-Issue oder leere Tabelle?");
    }

    _cache.monthlyStates = {};
    (ms.data || []).forEach((s) => {
      _cache.monthlyStates[`${s.year}-${s.month}`] = s;
    });

    _cache.oneOffEntries = {};
    (ooe.data || []).forEach((e) => {
      const k = `${e.year}-${e.month}`;
      if (!_cache.oneOffEntries[k]) _cache.oneOffEntries[k] = [];
      _cache.oneOffEntries[k].push(e);
    });

    _cache.tipsState = {};
    (tps.data || []).forEach((t) => {
      _cache.tipsState[t.tip_id] = t.status;
    });

    _ready = true;
    return true;
  } catch (e) {
    console.error("[state] bootstrap failed:", e);
    showToast("⚠ Verbindung fehlgeschlagen");
    return false;
  }
}

function stateTeardown() {
  _cache.userId = null;
  _cache.household = null;
  _cache.preferences = null;
  _cache.positions = [];
  _cache.routines = [];
  _cache.monthlyStates = {};
  _cache.oneOffEntries = {};
  _cache.tipsState = {};
  _ready = false;
}

/* ============================================================
   Key-Helpers
   ============================================================ */

function getKey() {
  const selM = document.getElementById("selMonth");
  const selY = document.getElementById("selYear");
  return `${selY.value}-${selM.value}`;
}

function _currentYM() {
  return {
    year: parseInt(document.getElementById("selYear").value, 10),
    month: parseInt(document.getElementById("selMonth").value, 10),
  };
}

/* ============================================================
   Monthly-State Helpers
   ============================================================ */

function _emptyMonthlyState(year, month) {
  // Snapshot der aktuellen Positionen anlegen — wird beim ersten
  // Insert mitgespeichert, damit historische Monate ihren damaligen
  // Zustand behalten, auch wenn der User später Beträge anpasst.
  const snapshot = {};
  _cache.positions.forEach((p) => {
    snapshot[p.id] = {
      name: p.name,
      amount: parseFloat(p.amount),
      kind: p.kind,
      day: p.day,
      category: p.category,
      yearly: !!p.yearly,
      quarterly: !!p.quarterly,
    };
  });
  return {
    user_id: _cache.userId,
    year,
    month,
    income_paid: {},
    expense_paid: {},
    routine_done: {},
    surplus_actual: null,
    positions_snapshot: snapshot,
  };
}

function _ensureMonthlyState(key) {
  if (_cache.monthlyStates[key]) return _cache.monthlyStates[key];
  const [yStr, mStr] = key.split("-");
  const ms = _emptyMonthlyState(parseInt(yStr, 10), parseInt(mStr, 10));
  _cache.monthlyStates[key] = ms;
  return ms;
}

/* ============================================================
   Read-Accessors (sync, aus Cache)
   ============================================================ */

function isIncPaid(id) {
  return !!_cache.monthlyStates[getKey()]?.income_paid?.[id];
}
function isExpPaid(id) {
  return !!_cache.monthlyStates[getKey()]?.expense_paid?.[id];
}
function isRoutineDone(id) {
  return !!_cache.monthlyStates[getKey()]?.routine_done?.[id];
}
function isTipDismissed(id) {
  return _cache.tipsState[id] === "dismissed";
}
function isTipAccepted(id) {
  return _cache.tipsState[id] === "accepted";
}

function getExtraIncome() {
  return (_cache.oneOffEntries[getKey()] || [])
    .filter((e) => e.kind === "income")
    .map((e) => ({ id: e.id, name: e.name, amount: parseFloat(e.amount) }));
}
function getExtraExpense() {
  return (_cache.oneOffEntries[getKey()] || [])
    .filter((e) => e.kind === "expense")
    .map((e) => ({ id: e.id, name: e.name, amount: parseFloat(e.amount) }));
}

function getIncome() {
  return _cache.positions
    .filter((p) => p.kind === "income")
    .map((p) => ({
      id: p.id,
      name: p.name,
      amount: parseFloat(p.amount),
      day: p.day,
    }));
}
function getExpenses() {
  return _cache.positions
    .filter((p) => p.kind === "expense")
    .map((p) => ({
      id: p.id,
      name: p.name,
      amount: parseFloat(p.amount),
      cat: p.category,
      yearly: !!p.yearly,
      quarterly: !!p.quarterly,
    }));
}

function getRoutines() {
  return _cache.routines.map((r) => ({
    id: r.id,
    day: r.day,
    title: r.title,
    desc: r.description,
  }));
}

function getSurplus(key) {
  const v = _cache.monthlyStates[key]?.surplus_actual;
  return v === null || v === undefined ? null : parseFloat(v);
}
function getKumuliert() {
  return Object.values(_cache.monthlyStates)
    .map((ms) => ms.surplus_actual)
    .filter((v) => v !== null && v !== undefined)
    .reduce((s, v) => s + parseFloat(v), 0);
}
function getSurplusCount() {
  return Object.values(_cache.monthlyStates).filter(
    (ms) => ms.surplus_actual !== null && ms.surplus_actual !== undefined,
  ).length;
}

/* --- Household-Spalten-Mapping ---
   alte Keys aus haushalt.js („hh_aktien", „hh_tg", …) auf
   die echten Spaltennamen der `household`-Tabelle abbilden. */
const _HH_COLUMN = {
  "hh_aktien":      "aktien",
  "hh_krypto":      "krypto",
  "hh_tg":          "tagesgeld",
  "hh_giro":        "girokonto",
  "hh_bar":         "bargeld",
  "hh_kredit":      "kredit",
  "hh_spar":        "sparplaene",
  "hh_var":         "variable_kosten",
  "hh_urlaub":      "bar_ausgabe",
  "hh_bar-ziel":    "bar_ziel",
  "hh_sparrate":    "bar_sparrate",
  "hh_nf-aktuell":  "nf_aktuell",
  "hh_nf-ausgabe":  "nf_ausgabe",
  "hh_nf-ziel":     "nf_ziel",
  "hh_nf-sparrate": "nf_sparrate",
  "hh_rate":        "kredit_rate",
  "hh_zins":        "kredit_zins",
};

function getAmt(id, def) {
  if (id.startsWith("hh_")) {
    const col = _HH_COLUMN[id];
    if (!col || !_cache.household) return def;
    const v = _cache.household[col];
    return v === null || v === undefined ? def : parseFloat(v);
  }
  // inc_/exp_ Beträge werden über getIncome/getExpenses gelesen.
  // Falls jemand doch direkt fragt, geben wir den aktuellen Position-Betrag zurück.
  if (id.startsWith("inc_") || id.startsWith("exp_")) {
    const posId = id.substring(4);
    const pos = _cache.positions.find((p) => p.id === posId);
    return pos ? parseFloat(pos.amount) : def;
  }
  return def;
}

function getName(id, def) {
  if (id.startsWith("inc_") || id.startsWith("exp_")) {
    const posId = id.substring(4);
    const pos = _cache.positions.find((p) => p.id === posId);
    return pos ? pos.name : def;
  }
  return def;
}

/* ============================================================
   Write-Accessors (optimistisch + async upsert)
   ============================================================ */

function setAmt(id, val) {
  if (id.startsWith("hh_")) {
    const col = _HH_COLUMN[id];
    if (!col || !_cache.household) return;
    _cache.household[col] = val;
    _upsertHouseholdField(col, val);
    return;
  }
  if (id.startsWith("inc_") || id.startsWith("exp_")) {
    const posId = id.substring(4);
    const pos = _cache.positions.find((p) => p.id === posId);
    if (!pos) return;
    pos.amount = val;
    _updatePositionField(posId, { amount: val });
  }
}

function setName(id, val) {
  if (id.startsWith("inc_") || id.startsWith("exp_")) {
    const posId = id.substring(4);
    const pos = _cache.positions.find((p) => p.id === posId);
    if (!pos) return;
    pos.name = val;
    _updatePositionField(posId, { name: val });
  }
}

function setSurplus(key, val) {
  const ms = _ensureMonthlyState(key);
  ms.surplus_actual = val;
  _upsertMonthlyState(ms);
}

function toggleInc(id) {
  const key = getKey();
  const ms = _ensureMonthlyState(key);
  ms.income_paid = { ...ms.income_paid, [id]: !ms.income_paid?.[id] };
  if (!ms.income_paid[id]) delete ms.income_paid[id];
  _upsertMonthlyState(ms);
  render();
}
function toggleExp(id) {
  const key = getKey();
  const ms = _ensureMonthlyState(key);
  ms.expense_paid = { ...ms.expense_paid, [id]: !ms.expense_paid?.[id] };
  if (!ms.expense_paid[id]) delete ms.expense_paid[id];
  _upsertMonthlyState(ms);
  render();
}
function toggleRoutine(id) {
  const key = getKey();
  const ms = _ensureMonthlyState(key);
  ms.routine_done = { ...ms.routine_done, [id]: !ms.routine_done?.[id] };
  if (!ms.routine_done[id]) delete ms.routine_done[id];
  _upsertMonthlyState(ms);
  renderRoutine();
}

function dismissTip(id) {
  _cache.tipsState[id] = "dismissed";
  _upsertTipState(id, "dismissed");
  renderTips();
}
function restoreTip(id) {
  delete _cache.tipsState[id];
  _deleteTipState(id);
  renderTips();
}
function acceptTip(id) {
  if (_cache.tipsState[id] === "accepted") {
    delete _cache.tipsState[id];
    _deleteTipState(id);
  } else {
    _cache.tipsState[id] = "accepted";
    _upsertTipState(id, "accepted");
  }
  renderTips();
}

/* --- Extras (one_off_entries) --- */

async function addIncome() {
  const n = document.getElementById("add-inc-name").value.trim();
  const a = parseFloat(document.getElementById("add-inc-amt").value);
  if (!n || isNaN(a) || a <= 0) return;
  await _addOneOff("income", n, a, "add-inc-name", "add-inc-amt");
}

async function addExpense() {
  const n = document.getElementById("add-exp-name").value.trim();
  const a = parseFloat(document.getElementById("add-exp-amt").value);
  if (!n || isNaN(a) || a <= 0) return;
  await _addOneOff("expense", n, a, "add-exp-name", "add-exp-amt");
}

async function _addOneOff(kind, name, amount, inpNameId, inpAmtId) {
  const key = getKey();
  const { year, month } = _currentYM();
  const sb = window.supabase;

  /* Eingabe sofort zurücksetzen + Liste aktualisieren — Optimistic UI
     mit temporärer ID, die durch die echte UUID ersetzt wird. */
  const tempId = "temp_" + Date.now() + Math.random().toString(36).slice(2, 6);
  const tempEntry = { id: tempId, user_id: _cache.userId, year, month, kind, name, amount };
  if (!_cache.oneOffEntries[key]) _cache.oneOffEntries[key] = [];
  _cache.oneOffEntries[key].push(tempEntry);

  document.getElementById(inpNameId).value = "";
  document.getElementById(inpAmtId).value = "";
  render();

  const { data, error } = await sb
    .from("one_off_entries")
    .insert({ user_id: _cache.userId, year, month, kind, name, amount })
    .select()
    .single();

  if (error) {
    console.error("[state] one_off insert failed:", error);
    showToast("⚠ Konnte nicht gespeichert werden");
    _cache.oneOffEntries[key] = _cache.oneOffEntries[key].filter((e) => e.id !== tempId);
    render();
    return;
  }

  const idx = _cache.oneOffEntries[key].findIndex((e) => e.id === tempId);
  if (idx >= 0) _cache.oneOffEntries[key][idx] = data;
  /* Re-render damit onclick-Handler im DOM die echte UUID statt der temp_-ID nutzen. */
  render();
}

async function delExtraIncome(id) {
  await _deleteOneOff(id);
}
async function delExtraExpense(id) {
  await _deleteOneOff(id);
}

async function _deleteOneOff(id) {
  const key = getKey();
  const list = _cache.oneOffEntries[key] || [];
  const before = [...list];
  _cache.oneOffEntries[key] = list.filter((e) => e.id !== id);
  render();

  /* Temporäre Einträge (noch nicht in Supabase) brauchen kein DELETE. */
  if (typeof id === "string" && id.startsWith("temp_")) return;

  const { error } = await window.supabase.from("one_off_entries").delete().eq("id", id);
  if (error) {
    console.error("[state] one_off delete failed:", error);
    showToast("⚠ Konnte nicht gelöscht werden");
    _cache.oneOffEntries[key] = before;
    render();
  }
}

async function editExtraIncome(id, newName, newAmt) {
  await _updateOneOff(id, newName, newAmt);
}
async function editExtraExpense(id, newName, newAmt) {
  await _updateOneOff(id, newName, newAmt);
}

async function _updateOneOff(id, name, amount) {
  const key = getKey();
  const list = _cache.oneOffEntries[key] || [];
  const item = list.find((e) => e.id === id);
  if (!item) return;
  const before = { name: item.name, amount: item.amount };
  item.name = name;
  item.amount = amount;
  render();

  if (typeof id === "string" && id.startsWith("temp_")) return;

  const { error } = await window.supabase
    .from("one_off_entries")
    .update({ name, amount })
    .eq("id", id);
  if (error) {
    console.error("[state] one_off update failed:", error);
    showToast("⚠ Konnte nicht gespeichert werden");
    item.name = before.name;
    item.amount = before.amount;
    render();
  }
}

/* ============================================================
   Interne Supabase-Writer
   ============================================================ */

async function _upsertHouseholdField(column, value) {
  const { error } = await window.supabase
    .from("household")
    .update({ [column]: value })
    .eq("user_id", _cache.userId);
  if (error) {
    console.error("[state] household update failed:", error);
    showToast("⚠ Speichern fehlgeschlagen");
  }
}

async function _updatePositionField(positionId, patch) {
  const { error } = await window.supabase
    .from("positions")
    .update(patch)
    .eq("id", positionId);
  if (error) {
    console.error("[state] position update failed:", error);
    showToast("⚠ Speichern fehlgeschlagen");
  }
}

async function _upsertMonthlyState(ms) {
  const { error, data } = await window.supabase
    .from("monthly_states")
    .upsert(
      {
        user_id: _cache.userId,
        year: ms.year,
        month: ms.month,
        income_paid: ms.income_paid,
        expense_paid: ms.expense_paid,
        routine_done: ms.routine_done,
        surplus_actual: ms.surplus_actual,
        positions_snapshot: ms.positions_snapshot,
      },
      { onConflict: "user_id,year,month" },
    )
    .select()
    .single();
  if (error) {
    console.error("[state] monthly_state upsert failed:", error);
    showToast("⚠ Speichern fehlgeschlagen");
    return;
  }
  /* Server-IDs/Zeitstempel zurücknehmen (id, created_at, updated_at). */
  if (data) {
    _cache.monthlyStates[`${ms.year}-${ms.month}`] = data;
  }
}

async function _upsertTipState(tipId, status) {
  const { error } = await window.supabase
    .from("tips_state")
    .upsert(
      { user_id: _cache.userId, tip_id: tipId, status },
      { onConflict: "user_id,tip_id" },
    );
  if (error) {
    console.error("[state] tip upsert failed:", error);
    showToast("⚠ Speichern fehlgeschlagen");
  }
}

async function _deleteTipState(tipId) {
  const { error } = await window.supabase
    .from("tips_state")
    .delete()
    .eq("user_id", _cache.userId)
    .eq("tip_id", tipId);
  if (error) {
    console.error("[state] tip delete failed:", error);
  }
}

/* ============================================================
   Globals explizit am window registrieren
   ============================================================
   Top-level function declarations in einem klassischen Script
   landen normalerweise automatisch am window. Wir setzen sie
   trotzdem explizit, weil das robuster gegen Caching-/Build-
   Konfigurationen ist und „undefined is not a function"-Fehler
   verhindert. */
window.stateBootstrap = stateBootstrap;
window.stateTeardown  = stateTeardown;
window.stateIsReady   = stateIsReady;

console.log("[state.js] loaded — stateBootstrap is", typeof stateBootstrap);
