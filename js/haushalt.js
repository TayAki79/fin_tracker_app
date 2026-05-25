/* ============================================================
   HAUSHALT — Vermögen, Monatsrechnung, Barreserve, Kredit
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

function updateHaushalt() {
  const v = (k, d) => getAmt("hh_" + k, d);

  /* Vermögen */
  const aktien = v("aktien", 1000);
  const krypto = v("krypto", 500);
  const tg = v("tg", 500);
  const giro = v("giro", 200);
  const bar = v("bar", 300);
  const kredit = v("kredit", 0);
  const netto = aktien + krypto + tg + giro + bar - kredit;

  /* Monatsrechnung */
  const gehalt = v("gehalt", 2000);
  const nebenein = v("nebenein", 300);
  const fixkosten = v("fixkosten", 1000);
  const spar = v("spar", 200);
  const varB = v("var", 500);
  const gesamtIn = gehalt + nebenein;
  const ueberschuss = gesamtIn - fixkosten - spar - varB;

  /* Barreserve */
  const urlaub = v("urlaub", 0);
  const barZiel = v("bar-ziel", 5000);
  const sparrate = v("sparrate", 100);
  const nachUrlaub = bar - urlaub;
  const fehl = nachUrlaub - barZiel;
  const monate = fehl < 0 && sparrate > 0 ? Math.ceil(Math.abs(fehl) / sparrate) : 0;

  /* Kredit */
  const rate = v("rate", 0);
  const zins = v("zins", 0);

  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  set("hv-aktien", fmt(aktien));
  set("hv-krypto", fmt(krypto));
  set("hv-tg", fmt(tg));
  set("hv-giro", fmt(giro));
  set("hv-bar", fmt(bar));
  set("hv-bar2", fmt(bar));
  set("hv-kredit", "−" + fmt(kredit));
  set("hv-kredit2", fmt(kredit));
  set("hv-netto", fmt(netto));

  set("hv-gehalt", fmt(gehalt));
  set("hv-nebenein", fmt(nebenein));
  set("hv-gesamt-in", fmt(gesamtIn));
  set("hv-fixkosten", "−" + fmt(fixkosten));
  set("hv-spar", "−" + fmt(spar));
  set("hv-var", "−" + fmt(varB));
  set("hv-ueberschuss", (ueberschuss >= 0 ? "+" : "") + fmt(ueberschuss));

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
  set("hv-rate", fmt(rate) + "/Monat");
  set("hv-zins", zins.toFixed(2).replace(".", ",") + " %");
}
