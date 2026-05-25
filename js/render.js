/* ============================================================
   RENDER — DOM-Rendering für alle Tabs
   ============================================================ */

function fmt(n) {
  return n.toFixed(2).replace(".", ",") + " €";
}
function progColor(pct) {
  return pct >= 100 ? "var(--accent-2)" : "var(--accent)";
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* --- Inline Edit (Zahlungen) ---
   rowType: "income" | "expense" | "extra-inc" | "extra-exp"
   Bearbeitet Name UND Betrag gleichzeitig. */
function startEdit(rowEl) {
  const id = rowEl.dataset.id;
  const rowType = rowEl.dataset.type;
  const currentName = rowEl.dataset.name;
  const currentAmt = parseFloat(rowEl.dataset.amt);
  rowEl.onclick = null;
  rowEl.classList.remove("clickable");
  rowEl.classList.add("editing");
  rowEl.innerHTML = `
    <input class="inline-input name-edit" id="ne-${id}" value="${escAttr(currentName)}" placeholder="Name" />
    <div class="amt-wrap">
      <input class="inline-input amt-edit" id="ei-${id}" value="${currentAmt.toFixed(2)}" type="number" step="0.01" min="0" />
      <button class="confirm-btn" onclick="confirmEdit('${rowType}','${id}')">✓</button>
    </div>`;
  const nameInp = document.getElementById("ne-" + id);
  const amtInp = document.getElementById("ei-" + id);
  nameInp.focus();
  nameInp.select();
  const handler = (e) => {
    if (e.key === "Enter") confirmEdit(rowType, id);
    if (e.key === "Escape") render();
  };
  nameInp.addEventListener("keydown", handler);
  amtInp.addEventListener("keydown", handler);
}
function confirmEdit(rowType, id) {
  const nameInp = document.getElementById("ne-" + id);
  const amtInp = document.getElementById("ei-" + id);
  if (!nameInp || !amtInp) return;
  const newName = nameInp.value.trim();
  const newAmt = parseFloat(amtInp.value);
  if (!newName || isNaN(newAmt) || newAmt < 0) return;
  if (rowType === "extra-inc") {
    editExtraIncome(id, newName, newAmt);
  } else if (rowType === "extra-exp") {
    editExtraExpense(id, newName, newAmt);
  } else {
    const prefix = rowType === "income" ? "inc_" : "exp_";
    setName(prefix + id, newName);
    setAmt(prefix + id, newAmt);
    render();
  }
  showToast("✓ Gespeichert");
}

/* --- Kumulierter Überschuss Box --- */
function saveSurplusMonth() {
  const inp = document.getElementById("kum-inp");
  if (!inp) return;
  const val = parseFloat(inp.value.replace(",", "."));
  if (isNaN(val)) return;
  const selM = document.getElementById("selMonth");
  setSurplus(getKey(), val);
  renderKumBox();
  showToast("✓ " + MONTHS[parseInt(selM.value)] + " gespeichert");
}
function renderKumBox() {
  const selM = document.getElementById("selMonth");
  const key = getKey();
  const cur = getSurplus(key);
  const kum = getKumuliert();
  const monthName = MONTHS[parseInt(selM.value)];
  const count = Object.keys(state.surplusEntries || {}).length;
  const box = document.getElementById("kum-box");
  if (!box) return;
  box.innerHTML = `
    <div class="lbl">Kumulierter Überschuss</div>
    <div class="val">${kum >= 0 ? "+" : ""}${fmt(kum)}</div>
    <div class="kum-entry">
      <input id="kum-inp" type="number" step="0.01" placeholder="${monthName}…" value="${cur !== null ? cur.toFixed(2) : ""}">
      <button onclick="saveSurplusMonth()">✓</button>
    </div>
    <div class="kum-sub">${count} Monat${count !== 1 ? "e" : ""} erfasst</div>`;
}

/* --- Zahlungen Tab --- */
function render() {
  const INCOME = getIncome();
  const EXPENSES = getExpenses();
  const extra = getExtraIncome();
  const extraExp = getExtraExpense();
  const allIncome = [...INCOME, ...extra];
  const allExpenses = [...EXPENSES, ...extraExp];

  const totalIn = allIncome.reduce((s, p) => s + p.amount, 0);
  const totalOut = allExpenses.reduce((s, p) => {
    if (p.yearly) return s + p.amount / 12;
    if (p.quarterly) return s + p.amount / 3;
    return s + p.amount;
  }, 0);

  /* Metrics */
  document.getElementById("metrics-top").innerHTML =
    `<div class="metric"><div class="lbl">Gesamteinnahmen</div><div class="val" style="color:var(--green)">${fmt(totalIn)}</div></div>` +
    `<div class="metric"><div class="lbl">Fixausgaben + Sparen (∅)</div><div class="val" style="color:var(--red)">${fmt(totalOut)}</div></div>` +
    `<div class="metric kum" id="kum-box"></div>`;
  renderKumBox();

  /* Progress: Einnahmen */
  const incPaidCount = allIncome.filter((p) => isIncPaid(p.id)).length;
  const incPct = allIncome.length
    ? Math.round((incPaidCount / allIncome.length) * 100)
    : 0;
  document.getElementById("prog-inc-label").textContent =
    `${incPaidCount} / ${allIncome.length} — ${incPct} %`;
  const ib = document.getElementById("prog-inc-bar");
  ib.style.width = incPct + "%";
  ib.style.background = progColor(incPct);

  /* Progress: Ausgaben */
  const expPaidCount = allExpenses.filter((p) => isExpPaid(p.id)).length;
  const expPct = allExpenses.length
    ? Math.round((expPaidCount / allExpenses.length) * 100)
    : 0;
  document.getElementById("prog-exp-label").textContent =
    `${expPaidCount} / ${allExpenses.length} — ${expPct} %`;
  const eb = document.getElementById("prog-exp-bar");
  eb.style.width = expPct + "%";
  eb.style.background = progColor(expPct);

  /* Einnahmen Liste */
  document.getElementById("income-list").innerHTML = allIncome
    .map((p) => {
      const done = isIncPaid(p.id);
      const isExtra = !INCOME.find((b) => b.id === p.id);
      const rowType = isExtra ? "extra-inc" : "income";
      const delBtn = isExtra
        ? `<button class="del-btn" onclick="event.stopPropagation();delExtraIncome('${p.id}')">✕</button>`
        : "";
      const dayTxt = p.day
        ? `<span style="font-size:14px;font-weight:600;color:var(--text3);margin-left:6px">→ ${p.day}</span>`
        : "";
      return `<div class="row clickable${done ? " done" : ""}" data-id="${p.id}" data-type="${rowType}" data-name="${escAttr(p.name)}" data-amt="${p.amount}" onclick="toggleInc('${p.id}')">
      <div style="display:flex;align-items:center"><div class="cb${done ? " blue" : ""}"></div><span class="rname">${p.name}${dayTxt}</span>${delBtn}</div>
      <div class="amt-wrap"><span class="amount green">+${fmt(p.amount)}</span><button class="edit-btn" onclick="event.stopPropagation();startEdit(this.closest('.row'))">✎</button></div>
    </div>`;
    })
    .join("");

  /* Ausgaben Liste */
  document.getElementById("expense-list").innerHTML = allExpenses
    .map((p) => {
      const done = isExpPaid(p.id);
      const isExtra = !EXPENSES.find((b) => b.id === p.id);
      const rowType = isExtra ? "extra-exp" : "expense";
      const dispAmt = p.yearly
        ? p.amount / 12
        : p.quarterly
          ? p.amount / 3
          : p.amount;
      const cat = isExtra
        ? {
            bg: "rgba(128,128,128,0.12)",
            color: "var(--text2)",
            label: "Extra",
          }
        : CAT[p.cat] || {
            bg: "rgba(128,128,128,0.1)",
            color: "var(--text2)",
            label: p.cat,
          };
      const tag = `<span class="badge" style="background:${cat.bg};color:${cat.color}">${p.yearly ? "p.a." : p.quarterly ? "p.Q." : cat.label}</span>`;
      const sub =
        p.yearly || p.quarterly
          ? `<div class="sub-amount">${fmt(p.amount)} ${p.yearly ? "p.a." : "p.Q."}</div>`
          : "";
      const delBtn = isExtra
        ? `<button class="del-btn" onclick="event.stopPropagation();delExtraExpense('${p.id}')">✕</button>`
        : "";
      return `<div class="row clickable${done ? " done" : ""}" data-id="${p.id}" data-type="${rowType}" data-name="${escAttr(p.name)}" data-amt="${p.amount}" onclick="toggleExp('${p.id}')">
      <div style="display:flex;align-items:center"><div class="cb${done ? " green" : ""}"></div><span class="rname">${p.name}${tag}</span>${delBtn}</div>
      <div style="text-align:right">
        <div class="amt-wrap" style="justify-content:flex-end">
          <button class="edit-btn" onclick="event.stopPropagation();startEdit(this.closest('.row'))">✎</button>
          <div class="amount${done ? " gray" : " red"}">${fmt(dispAmt)}</div>
        </div>${sub}
      </div>
    </div>`;
    })
    .join("");

  /* Haushalt-Monatsrechnung spiegelt Zahlungen — bei jedem Zahlungs-Re-Render mitziehen */
  if (typeof updateHaushalt === "function") updateHaushalt();
}

/* --- Routine Tab --- */
function renderRoutine() {
  const done = ROUTINE_ITEMS.filter((r) => isRoutineDone(r.id)).length;
  const pct = Math.round((done / ROUTINE_ITEMS.length) * 100);
  document.getElementById("prog-routine-label").textContent =
    `${done} / ${ROUTINE_ITEMS.length} — ${pct} %`;
  const rb = document.getElementById("prog-routine-bar");
  rb.style.width = pct + "%";
  rb.style.background = progColor(pct);

  document.getElementById("routine-list").innerHTML = ROUTINE_ITEMS.map((r) => {
    const d = isRoutineDone(r.id);
    return `<div class="routine-item">
      <div class="routine-day"><span>${r.day}</span></div>
      <div class="routine-card${d ? " done" : ""}" onclick="toggleRoutine('${r.id}')">
        <div class="cb${d ? " green" : ""}"></div>
        <div class="routine-text"><div class="rtitle">${r.title}</div><div class="rdesc">${r.desc}</div></div>
      </div>
    </div>`;
  }).join("");
}

/* --- Tips Tab --- */
let archiveOpen = false;
function toggleArchive() {
  archiveOpen = !archiveOpen;
  document.getElementById("arc-toggle").classList.toggle("open", archiveOpen);
  document.getElementById("archive-body").classList.toggle("open", archiveOpen);
  document.getElementById("arc-arrow").textContent = archiveOpen ? "▲" : "▼";
}
function renderTips() {
  const visible = TIPS_DATA.filter((t) => !isTipDismissed(t.id));
  const dismissed = TIPS_DATA.filter((t) => isTipDismissed(t.id));

  document.getElementById("tips-list").innerHTML =
    visible.length === 0
      ? `<div style="padding:20px;text-align:center;color:var(--text3);font-size:14px;font-weight:700;letter-spacing:0.08em">ALLE TIPPS BEARBEITET</div>`
      : visible
          .map((t) => {
            const accepted = isTipAccepted(t.id);
            return `<div class="tip" style="background:${t.bg};border-color:${t.border}">
          <div style="margin-bottom:8px"><span class="tip-priority" style="background:${t.bg};color:${t.color};border:1px solid ${t.border}">${t.priorityLabel}</span></div>
          <div class="tip-text">${t.text}</div>
          <div class="tip-actions">
            <button class="tip-btn" onclick="acceptTip('${t.id}')" style="border-color:${accepted ? t.color : "var(--border2)"};color:${accepted ? t.color : "var(--text2)"};background:${accepted ? t.bg : "transparent"}">${accepted ? "✓ To-Do" : "Annehmen"}</button>
            <button class="tip-btn" onclick="dismissTip('${t.id}')" style="border-color:var(--border);color:var(--text3)">Verwerfen</button>
          </div>
        </div>`;
          })
          .join("");

  document.getElementById("arc-count").textContent = dismissed.length;
  document.getElementById("archive-body").innerHTML =
    dismissed.length === 0
      ? `<div class="arc-empty">Keine verworfenen Empfehlungen.</div>`
      : dismissed
          .map(
            (t) => `<div class="arc-tip">
        <div style="margin-bottom:6px"><span class="tip-priority" style="background:${t.bg};color:${t.color};border:1px solid ${t.border}">${t.priorityLabel}</span></div>
        <div class="arc-tip-text">${t.text}</div>
        <button class="btn-restore" onclick="restoreTip('${t.id}')">Zurückholen</button>
      </div>`,
          )
          .join("");
}
