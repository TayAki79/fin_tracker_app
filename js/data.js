/* ============================================================
   DATA — Statische Definitionen: Einnahmen, Ausgaben,
           Routine, Tipps, Kategorien
   ============================================================ */

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const INCOME_BASE_DEF = [
  { id: "gehalt", name: "Gehalt Aki (netto)", amount: 2600, day: "1." },
  { id: "pflegegeld", name: "Pflegegeld AOK", amount: 347, day: "1." },
  {
    id: "de_rente",
    name: "Deutsche Rente + Witwerrente Vater",
    amount: 253.87,
    day: "30.",
  },
  {
    id: "sozial",
    name: "Sozialunterstützung Vater",
    amount: 76.07,
    day: "30.",
  },
  {
    id: "fr_rente",
    name: "Französische Rente Vater",
    amount: 523.52,
    day: "9.",
  },
];

const EXPENSES_DEF = [
  { id: "miete", name: "Miete", amount: 1302, cat: "wohnen" },
  { id: "strom", name: "Strom", amount: 73, cat: "wohnen" },
  { id: "internet", name: "Internet", amount: 32.97, cat: "wohnen" },
  { id: "targo", name: "TARGO Kredit", amount: 433.4, cat: "kredit" },
  {
    id: "canadalife",
    name: "Canada Life BU",
    amount: 163.81,
    cat: "versicherung",
  },
  { id: "mobilfunk", name: "Mobilfunk", amount: 9.99, cat: "kommunikation" },
  { id: "fitness", name: "Fitnessstudio", amount: 39.99, cat: "lifestyle" },
  { id: "spotify", name: "Spotify", amount: 12.99, cat: "abo" },
  { id: "netflix", name: "Netflix", amount: 4.99, cat: "abo" },
  { id: "disney", name: "Disney+", amount: 3.99, cat: "abo" },
  { id: "appletv", name: "Apple TV+", amount: 9.99, cat: "abo" },
  { id: "audible", name: "Audible", amount: 9.95, cat: "abo" },
  { id: "icloud", name: "iCloud 2×", amount: 5.98, cat: "abo" },
  { id: "claude", name: "Claude", amount: 21, cat: "abo" },
  { id: "freecodecamp", name: "freeCodeCamp", amount: 4.65, cat: "abo" },
  {
    id: "arag",
    name: "ARAG Zahnzusatz Sohn",
    amount: 12.28,
    cat: "versicherung",
  },
  {
    id: "barentnahme",
    name: "Barentnahme variables Budget",
    amount: 1000,
    cat: "variabel",
  },
  { id: "sparen", name: "Sparpläne ETF/Krypto", amount: 500.5, cat: "sparen" },
  { id: "gez", name: "GEZ", amount: 55.08, cat: "wohnen", quarterly: true },
  {
    id: "hfk",
    name: "Haftpflicht HFK",
    amount: 51.85,
    cat: "versicherung",
    yearly: true,
  },
  {
    id: "hausrat",
    name: "Hausrat",
    amount: 71.08,
    cat: "versicherung",
    yearly: true,
  },
  {
    id: "adac_rs",
    name: "ADAC Rechtsschutz",
    amount: 328.84,
    cat: "versicherung",
    yearly: true,
  },
  {
    id: "huk_kfz",
    name: "HUK Kfz Vater",
    amount: 207.11,
    cat: "versicherung",
    quarterly: true,
    vater: true,
  },
  {
    id: "adac_v",
    name: "ADAC Schutz Vater",
    amount: 54,
    cat: "versicherung",
    yearly: true,
    vater: true,
  },
  {
    id: "postbank",
    name: "Postbank Vater",
    amount: 17.7,
    cat: "kommunikation",
    quarterly: true,
    vater: true,
  },
];

const ROUTINE_ITEMS = [
  {
    id: "r1",
    day: "30. Vormonat",
    title: "Renten prüfen",
    desc: "Deutsche Rente + Witwerrente + Sozialamt auf Vaterkonto eingegangen?",
  },
  {
    id: "r2",
    day: "27.–28.",
    title: "Daueraufträge prüfen",
    desc: "Alle Daueraufträge aktiv? Pflegegeld-DA korrekt eingerichtet?",
  },
  {
    id: "r3",
    day: "01.",
    title: "Gehalt & Pflegegeld prüfen",
    desc: "Gehalt (~2.600 €) und Pflegegeld (347 €) angekommen?",
  },
  {
    id: "r4",
    day: "01.",
    title: "1.000 € Barentnahme",
    desc: "500 € vom eigenen Konto + 500 € vom Vaterkonto — Einkäufe, Tanken, Auswärtsessen, Sonstiges",
  },
  {
    id: "r5",
    day: "01.",
    title: "320 € zurücklegen",
    desc: "320 € sofort in Barreserve — nicht anfassen",
  },
  {
    id: "r6",
    day: "01.",
    title: "680 € Monatsbudget",
    desc: "Mit 680 € in den Monat starten — wenn es weg ist, ist es weg",
  },
  {
    id: "r7",
    day: "09.",
    title: "Französische Rente prüfen",
    desc: "523,52 € auf Vaterkonto eingegangen?",
  },
  {
    id: "r8",
    day: "Monatsmitte",
    title: "Budget-Check",
    desc: "Wie viel vom 680 € Budget ist noch übrig?",
  },
  {
    id: "r9",
    day: "Monatsende",
    title: "Monatsabschluss",
    desc: "Überschuss berechnen und in Barreserve legen.",
  },
  {
    id: "r10",
    day: "Monatsende",
    title: "Nächsten Monat vorbereiten",
    desc: "Offene Zahlungen prüfen, Sonderausgaben im Blick behalten.",
  },
];

const TIPS_DATA = [
  {
    id: "t1",
    priorityLabel: "Hoch",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.25)",
    color: "var(--amber)",
    text: "Streaming: 4 aktive Dienste (Netflix, Disney+, Apple TV+, Spotify). Ein Dienst weniger spart 4–22 €/Monat — über ein Jahr 50–264 €.",
  },
  {
    id: "t2",
    priorityLabel: "Langfristig",
    bg: "rgba(157,108,255,0.08)",
    border: "rgba(157,108,255,0.25)",
    color: "var(--purple)",
    text: "Mit 50 frei: In ~36 Monaten fällt die TARGO-Rate (433 €/Monat) weg. Plane jetzt schon, diesen Betrag direkt in ETFs umzuleiten.",
  },
  {
    id: "t3",
    priorityLabel: "Kritisch",
    bg: "rgba(255,77,109,0.08)",
    border: "rgba(255,77,109,0.25)",
    color: "var(--red)",
    text: "Pflegegeld-DA: Stelle sicher, dass die 347 € pünktlich am 1. jeden Monats auf deinem Konto eingehen. Grundlage der gesamten Monatsplanung.",
  },
  {
    id: "t4",
    priorityLabel: "Langfristig",
    bg: "rgba(157,108,255,0.08)",
    border: "rgba(157,108,255,0.25)",
    color: "var(--purple)",
    text: "Barreserve: Nach Thailand ~5.780 €. Bei 320 €/Monat dauert es ~19 Monate bis 12.000 €. Konsequent bleiben.",
  },
  {
    id: "t5",
    priorityLabel: "Mittel",
    bg: "rgba(77,159,255,0.08)",
    border: "rgba(77,159,255,0.25)",
    color: "var(--blue)",
    text: "Tagesgeld Comdirect: 0,12 € — praktisch ungenutzt. Prüfe den Zinssatz und lagere den Girokonto-Puffer (500 €) dorthin aus.",
  },
  {
    id: "t6",
    priorityLabel: "Hoch",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.25)",
    color: "var(--amber)",
    text: "Variables Budget: Die 680 € Bargeld sind dein härtestes Werkzeug. Kein Nachfüllen — das schützt deinen Überschuss und die Barreserve.",
  },
];

const CAT = {
  wohnen: {
    bg: "rgba(77,159,255,0.15)",
    color: "var(--blue)",
    label: "Wohnen",
  },
  kredit: { bg: "rgba(255,77,109,0.15)", color: "var(--red)", label: "Kredit" },
  versicherung: {
    bg: "rgba(157,108,255,0.15)",
    color: "var(--purple)",
    label: "Versicherung",
  },
  kommunikation: {
    bg: "rgba(0,212,170,0.15)",
    color: "var(--green)",
    label: "Komm.",
  },
  lifestyle: {
    bg: "rgba(255,170,0,0.15)",
    color: "var(--amber)",
    label: "Lifestyle",
  },
  abo: { bg: "rgba(255,120,50,0.15)", color: "#ff7832", label: "Abo" },
  sparen: {
    bg: "rgba(0,212,170,0.15)",
    color: "var(--green)",
    label: "Sparen",
  },
  variabel: {
    bg: "rgba(255,170,0,0.15)",
    color: "var(--amber)",
    label: "Variabel",
  },
};
