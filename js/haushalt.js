/* ============================================================
   HAUSHALT — Vermögen, Monatsrechnung, Barreserve, Kredit,
             Weiteres Vermögen (Custom)
   ============================================================ */

function editHaushalt(key, def, label) {
  const cur = getAmt("hh_" + key, def);
  const val = prompt(`${label} — neuer Betrag (€):`, cur.toFixed(2));
  if (val === null) return;
  const n = parseFloat(val.replace(",", "."));
  if (isNaN(n) || n < 0) return;
  setAmt("hh_" + key, n);
  updateHaushalt();
  showToast("✓ Betrag aktualisiert");
}

/* --- Klappbare Boxen (persistiert in localStorage) --- */
function getCollapsedMap() {
  try {
    return JSON.parse(localStorage.getItem("fc-collapsed") || "{}");
  } catch {
    return {};
  }
}
function toggleHaushaltBox(id) {
  const box = document.getElementById(id);
  if (!box) return;
  const map = getCollapsedMap();
  const next = !map[id];
  if (next) map[id] = true;
  else delete map[id];
  localStorage.setItem("fc-collapsed", JSON.stringify(map));
  box.classList.toggle("collapsed", next);
}
function applyHaushaltCollapse() {
  const map = getCollapsedMap();
  document.querySelectorAll("#tab-haushalt .summary-box").forEach((box) => {
    if (box.id && map[box.id]) box.classList.add("collapsed");
    else box.classList.remove("collapsed");
  });
}

function updateHaushalt() {
  const v = (k, d) => getAmt("hh_" + k, d);

  /* --- Vermögen --- */
  const aktien = v("aktien", 1000);
  const krypto = v("krypto", 500);
  const tg = v("tg", 500);
  const giro = v("giro", 200);
  const bar = v("bar", 300);
  const kredit = v("kredit", 0);
  const netto = aktien + krypto + tg + giro + bar - kredit;

  /* --- Monatsrechnung: Sync mit Zahlungen --- */
  const INCOME = getIncome();
  const EXPENSES = getExpenses();
  const allIncome = [...INCOME, ...getExtraIncome()];
  const allExpenses = [...EXPENSES, ...getExtraExpense()];

  const gesamtIn = allIncome.reduce((s, p) => s + p.amount, 0);
  const fixOut = allExpenses.reduce((s, p) => {
    if (p.yearly) return s + p.amount / 12;
    if (p.quarterly) return s + p.amount / 3;
    return s + p.amount;
  }, 0);

  const spar = v("spar", 200);
  const varB = v("var", 500);
  const gesamtOut = fixOut + spar + varB;
  const ueberschuss = gesamtIn - gesamtOut;

  /* --- Ziel Barreserve --- */
  const urlaub = v("urlaub", 0);
  const barZiel = v("bar-ziel", 5000);
  const sparrate = v("sparrate", 100);
  const nachUrlaub = bar - urlaub;
  const fehl = nachUrlaub - barZiel;
  const monate = fehl < 0 && sparrate > 0 ? Math.ceil(Math.abs(fehl) / sparrate) : 0;

  /* --- Ziel Notfallkonto (gleiche Struktur, eigene Beträge) --- */
  const nfAkt = v("nf-aktuell", 0);
  const nfAusgabe = v("nf-ausgabe", 0);
  const nfZiel = v("nf-ziel", 5000);
  const nfSparrate = v("nf-sparrate", 100);
  const nfNach = nfAkt - nfAusgabe;
  const nfFehl = nfNach - nfZiel;
  const nfMonate =
    nfFehl < 0 && nfSparrate > 0 ? Math.ceil(Math.abs(nfFehl) / nfSparrate) : 0;

  /* --- Kredit --- */
  const rate = v("rate", 0);
  const zins = v("zins", 0);

  /* ===== Render ===== */
  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  /* Vermögen */
  set("hv-aktien", fmt(aktien));
  set("hv-krypto", fmt(krypto));
  set("hv-tg", fmt(tg));
  set("hv-giro", fmt(giro));
  set("hv-bar", fmt(bar));
  set("hv-bar2", fmt(bar));
  set("hv-netto", fmt(netto));

  /* Monatsrechnung — Einnahmen-Liste */
  const incEl = document.getElementById("hh-monat-in");
  if (incEl) {
    incEl.innerHTML = allIncome.length
      ? allIncome
          .map(
            (p) =>
              `<div class="srow"><span>${escAttr(p.name)}</span><span style="color:var(--green)">${fmt(p.amount)}</span></div>`,
          )
          .join("")
      : `<div class="srow muted"><span>Keine Einnahmen in Zahlungen</span><span>—</span></div>`;
  }

  set("hv-gesamt-in", fmt(gesamtIn));
  set("hv-fixkosten", "−" + fmt(fixOut));
  set("hv-spar", "−" + fmt(spar));
  set("hv-var", "−" + fmt(varB));
  set("hv-gesamt-out", "−" + fmt(gesamtOut));
  set("hv-ueberschuss", (ueberschuss >= 0 ? "+" : "") + fmt(ueberschuss));

  /* Barreserve */
  set("hv-urlaub", "−" + fmt(urlaub));
  set("hv-nach-urlaub", fmt(nachUrlaub));
  set("hv-bar-ziel", fmt(barZiel));
  set("hv-fehl", (fehl >= 0 ? "+" : "") + fmt(fehl));
  set("hv-sparrate", fmt(sparrate));
  set(
    "hv-monate-label",
    monate > 0 ? `~${monate} Monate à ${fmt(sparrate)}` : "Ziel erreicht!",
  );
  set("hv-ziel-arrow", "→ " + fmt(barZiel));

  /* Kredit */
  set("hv-kredit2", fmt(kredit));
  set("hv-rate", fmt(rate) + "/Monat");
  set("hv-zins", zins.toFixed(2).replace(".", ",") + " %");

  /* Ziel Notfallkonto */
  set("hv-nf-aktuell", fmt(nfAkt));
  set("hv-nf-ausgabe", "−" + fmt(nfAusgabe));
  set("hv-nf-nach-ausgabe", fmt(nfNach));
  set("hv-nf-ziel", fmt(nfZiel));
  set("hv-nf-fehl", (nfFehl >= 0 ? "+" : "") + fmt(nfFehl));
  set("hv-nf-sparrate", fmt(nfSparrate));
  set(
    "hv-nf-monate-label",
    nfMonate > 0 ? `~${nfMonate} Monate à ${fmt(nfSparrate)}` : "Ziel erreicht!",
  );
  set("hv-nf-ziel-arrow", "→ " + fmt(nfZiel));

  /* Klapp-Zustand wiederherstellen */
  applyHaushaltCollapse();
}
