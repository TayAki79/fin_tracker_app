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
  const etfTr = v("etf-tr", 5157.21);
  const etfSc = v("etf-sc", 3195.12);
  const krypto = v("krypto", 2152.16);
  const tg = v("tg", 400.21);
  const giro = v("giro", 155.73);
  const bar = v("bar", 7780);
  const kredit = v("kredit", 15000);
  const netto = etfTr + etfSc + krypto + tg + giro + bar - kredit;

  /* Monatsrechnung */
  const gehalt = v("gehalt", 2600);
  const pflege = v("pflege", 347);
  const vaterIn = v("vater-in", 853.46);
  const fixAki = v("fix-aki", 2196.98);
  const fixVater = v("fix-vater", 79.44);
  const spar = v("spar", 500.5);
  const varB = v("var", 700);
  const gesamtIn = gehalt + pflege + vaterIn;
  const ueberschuss = gesamtIn - fixAki - fixVater - spar - varB;

  /* Barreserve */
  const urlaub = v("urlaub", 2000);
  const barZiel = v("bar-ziel", 12000);
  const nachUrlaub = bar - urlaub;
  const fehl = nachUrlaub - barZiel;
  const monate = fehl < 0 ? Math.ceil(Math.abs(fehl) / 320) : 0;

  /* Kredit */
  const rate = v("rate", 433.4);

  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  set("hv-etf-tr", fmt(etfTr));
  set("hv-etf-sc", fmt(etfSc));
  set("hv-krypto", fmt(krypto));
  set("hv-tg", fmt(tg));
  set("hv-giro", fmt(giro));
  set("hv-bar", fmt(bar));
  set("hv-bar2", fmt(bar));
  set("hv-kredit", "−" + fmt(kredit));
  set("hv-kredit2", "~" + fmt(kredit));
  set("hv-netto", fmt(netto));

  set("hv-gehalt", fmt(gehalt));
  set("hv-pflege", fmt(pflege));
  set("hv-vater-in", fmt(vaterIn));
  set("hv-gesamt-in", fmt(gesamtIn));
  set("hv-fix-aki", "−" + fmt(fixAki));
  set("hv-fix-vater", "−" + fmt(fixVater));
  set("hv-spar", "−" + fmt(spar));
  set("hv-var", "−" + fmt(varB));
  set("hv-ueberschuss", (ueberschuss >= 0 ? "+" : "") + fmt(ueberschuss));

  set("hv-urlaub", "−" + fmt(urlaub));
  set("hv-nach-urlaub", fmt(nachUrlaub));
  set("hv-bar-ziel", fmt(barZiel));
  set("hv-fehl", (fehl >= 0 ? "+" : "") + fmt(fehl));
  set(
    "hv-monate-label",
    monate > 0 ? `~${monate} Monate à 320 €` : "Ziel erreicht!",
  );
  set("hv-rate", fmt(rate) + "/Monat");
}
