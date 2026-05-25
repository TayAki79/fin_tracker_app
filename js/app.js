/* ============================================================
   APP — Initialisierung, Theme, Tab-Switching, Event Listener
   Einstiegspunkt der Anwendung.
   ============================================================ */

/* --- Datum in Topbar --- */
const now = new Date();
const dd = String(now.getDate()).padStart(2, "0");
const mm = String(now.getMonth() + 1).padStart(2, "0");
const yyyy = now.getFullYear();
document.getElementById("topdate").textContent = `${dd}.${mm}.${yyyy}`;

/* --- Issue-Nummer: fortlaufende Ausgabe seit Januar 2025 --- */
function updateIssueNum() {
  const sM = document.getElementById("selMonth");
  const sY = document.getElementById("selYear");
  if (!sM || !sY) return;
  const m = parseInt(sM.value);
  const y = parseInt(sY.value);
  const num = (y - 2025) * 12 + m + 1;
  const el = document.getElementById("issuenum");
  if (el) el.textContent = String(num).padStart(3, "0");
}

/* --- Monats- und Jahres-Selector befüllen --- */
const selM = document.getElementById("selMonth");
const selY = document.getElementById("selYear");

MONTHS.forEach((m, i) => {
  const o = document.createElement("option");
  o.value = i;
  o.textContent = m;
  if (i === now.getMonth()) o.selected = true;
  selM.appendChild(o);
});
[2025, 2026, 2027, 2028].forEach((y) => {
  const o = document.createElement("option");
  o.value = y;
  o.textContent = y;
  if (y === now.getFullYear()) o.selected = true;
  selY.appendChild(o);
});

/* --- Theme --- */
const savedTheme = localStorage.getItem("fc-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
document.getElementById("themeBtn").textContent =
  savedTheme === "dark" ? "☀️" : "🌙";

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.getElementById("themeBtn").textContent =
    next === "dark" ? "☀️" : "🌙";
  localStorage.setItem("fc-theme", next);
}

/* --- Tab Switching --- */
function showTab(name, el) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  if (el) el.classList.add("active");
}

/* --- Monat/Jahr Wechsel löst Re-Render aus --- */
selM.addEventListener("change", () => {
  render();
  updateIssueNum();
});
selY.addEventListener("change", () => {
  render();
  updateIssueNum();
});

/* --- Initialer Render --- */
updateLastExportInfo();
updateIssueNum();
render();
renderRoutine();
renderTips();
updateHaushalt();
