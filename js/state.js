/* ============================================================
   STATE — localStorage Abstraktion
   Einziger Ort, der localStorage kennt und beschreibt.
   ============================================================ */

const STORAGE_KEY = "fc-state-v4";

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getKey() {
  const selM = document.getElementById("selMonth");
  const selY = document.getElementById("selYear");
  return `${selY.value}-${selM.value}`;
}

/* --- Checked States --- */
function isIncPaid(id) {
  return !!state[getKey()]?.incPaid?.[id];
}
function isExpPaid(id) {
  return !!state[getKey()]?.expPaid?.[id];
}
function isRoutineDone(id) {
  return !!state[getKey()]?.routine?.[id];
}
function isTipDismissed(id) {
  return !!state.tipsDismissed?.[id];
}
function isTipAccepted(id) {
  return !!state.tipsAccepted?.[id];
}

/* --- Extra Income --- */
function getExtraIncome() {
  return state[getKey()]?.extraIncome || [];
}

/* --- Extra Expense --- */
function getExtraExpense() {
  return state[getKey()]?.extraExpense || [];
}

/* --- Amounts --- */
function getAmt(id, def) {
  return state.amounts?.[id] ?? def;
}
function setAmt(id, val) {
  if (!state.amounts) state.amounts = {};
  state.amounts[id] = val;
  save();
}

/* --- Names (überschriebene Bezeichnungen für Einnahmen/Ausgaben) --- */
function getName(id, def) {
  return state.names?.[id] ?? def;
}
function setName(id, val) {
  if (!state.names) state.names = {};
  state.names[id] = val;
  save();
}

/* --- Kumulierter Überschuss --- */
function getSurplus(key) {
  return state.surplusEntries?.[key] ?? null;
}
function setSurplus(key, val) {
  if (!state.surplusEntries) state.surplusEntries = {};
  state.surplusEntries[key] = val;
  save();
}
function getKumuliert() {
  return Object.values(state.surplusEntries || {}).reduce((s, v) => s + v, 0);
}

/* --- Helpers: Income & Expenses mit gespeicherten Namen & Beträgen --- */
function getIncome() {
  return INCOME_BASE_DEF.map((p) => ({
    ...p,
    name: getName("inc_" + p.id, p.name),
    amount: getAmt("inc_" + p.id, p.amount),
  }));
}
function getExpenses() {
  return EXPENSES_DEF.map((p) => ({
    ...p,
    name: getName("exp_" + p.id, p.name),
    amount: getAmt("exp_" + p.id, p.amount),
  }));
}

/* --- Toggle Actions --- */
function toggleInc(id) {
  const k = getKey();
  if (!state[k]) state[k] = {};
  if (!state[k].incPaid) state[k].incPaid = {};
  state[k].incPaid[id] = !state[k].incPaid[id];
  save();
  render();
}
function toggleExp(id) {
  const k = getKey();
  if (!state[k]) state[k] = {};
  if (!state[k].expPaid) state[k].expPaid = {};
  state[k].expPaid[id] = !state[k].expPaid[id];
  save();
  render();
}
function toggleRoutine(id) {
  const k = getKey();
  if (!state[k]) state[k] = {};
  if (!state[k].routine) state[k].routine = {};
  state[k].routine[id] = !state[k].routine[id];
  save();
  renderRoutine();
}
function dismissTip(id) {
  if (!state.tipsDismissed) state.tipsDismissed = {};
  state.tipsDismissed[id] = true;
  if (state.tipsAccepted) delete state.tipsAccepted[id];
  save();
  renderTips();
}
function restoreTip(id) {
  if (state.tipsDismissed) delete state.tipsDismissed[id];
  save();
  renderTips();
}
function acceptTip(id) {
  if (!state.tipsAccepted) state.tipsAccepted = {};
  state.tipsAccepted[id] = !state.tipsAccepted[id];
  save();
  renderTips();
}
function addIncome() {
  const n = document.getElementById("add-inc-name").value.trim();
  const a = parseFloat(document.getElementById("add-inc-amt").value);
  if (!n || isNaN(a) || a <= 0) return;
  const k = getKey();
  if (!state[k]) state[k] = {};
  if (!state[k].extraIncome) state[k].extraIncome = [];
  state[k].extraIncome.push({ id: "ei" + Date.now(), name: n, amount: a });
  document.getElementById("add-inc-name").value = "";
  document.getElementById("add-inc-amt").value = "";
  save();
  render();
}
function delExtraIncome(id) {
  const k = getKey();
  if (!state[k]?.extraIncome) return;
  state[k].extraIncome = state[k].extraIncome.filter((e) => e.id !== id);
  save();
  render();
}
function editExtraIncome(id, newName, newAmt) {
  const k = getKey();
  if (!state[k]?.extraIncome) return;
  const item = state[k].extraIncome.find((e) => e.id === id);
  if (!item) return;
  item.name = newName;
  item.amount = newAmt;
  save();
  render();
}
function addExpense() {
  const n = document.getElementById("add-exp-name").value.trim();
  const a = parseFloat(document.getElementById("add-exp-amt").value);
  if (!n || isNaN(a) || a <= 0) return;
  const k = getKey();
  if (!state[k]) state[k] = {};
  if (!state[k].extraExpense) state[k].extraExpense = [];
  state[k].extraExpense.push({ id: "ee" + Date.now(), name: n, amount: a });
  document.getElementById("add-exp-name").value = "";
  document.getElementById("add-exp-amt").value = "";
  save();
  render();
}
function delExtraExpense(id) {
  const k = getKey();
  if (!state[k]?.extraExpense) return;
  state[k].extraExpense = state[k].extraExpense.filter((e) => e.id !== id);
  save();
  render();
}
function editExtraExpense(id, newName, newAmt) {
  const k = getKey();
  if (!state[k]?.extraExpense) return;
  const item = state[k].extraExpense.find((e) => e.id === id);
  if (!item) return;
  item.name = newName;
  item.amount = newAmt;
  save();
  render();
}

/* --- Import / Export --- */
function exportData() {
  const obj = {
    version: "fc-v9",
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  a.href = url;
  a.download = `finanz-cockpit-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const info = `Letzter Export: ${d.toLocaleDateString("de-DE")} um ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  localStorage.setItem("fc-last-export", info);
  updateLastExportInfo();
  showToast("✓ Stand exportiert");
}
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const p = JSON.parse(e.target.result);
      if (!p.data) throw new Error();
      state = p.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
      renderRoutine();
      renderTips();
      updateHaushalt();
      updateLastExportInfo();
      showToast("✓ Stand importiert");
    } catch {
      showToast("Fehler: Datei ungültig");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}
function updateLastExportInfo() {
  const el = document.getElementById("last-export-info");
  if (el)
    el.textContent =
      localStorage.getItem("fc-last-export") || "Noch kein Export gespeichert.";
}
