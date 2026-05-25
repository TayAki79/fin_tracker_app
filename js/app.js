/* ============================================================
   APP — Initialisierung, Theme, Tab-Switching, Event Listener
   Einstiegspunkt der Anwendung.
   ============================================================ */

/* --- Datum in Topbar --- */
const now = new Date();
document.getElementById("topdate").textContent = now.toLocaleDateString(
  "de-DE",
  { day: "2-digit", month: "2-digit", year: "numeric" },
);

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
selM.addEventListener("change", render);
selY.addEventListener("change", render);

/* --- Initialer Render --- */
updateLastExportInfo();
render();
renderRoutine();
renderTips();
updateHaushalt();
