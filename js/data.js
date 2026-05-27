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

/* Hinweis: Per-User-Defaults (Einnahmen, Ausgaben, Routinen) leben jetzt
   im Supabase-Signup-Bootstrap-Trigger (supabase/etappe-c-bootstrap.sql).
   Diese Datei hält nur noch statische, anwendungs-globale Inhalte. */

const TIPS_DATA = [
  {
    id: "t1",
    priorityLabel: "Kritisch",
    bg: "rgba(255,77,109,0.08)",
    border: "rgba(255,77,109,0.25)",
    color: "var(--red)",
    text: "Notgroschen aufbauen: Mindestens 3 Monatsausgaben als Reserve auf einem Tagesgeldkonto. Ohne diesen Puffer wird jede unerwartete Rechnung zur Kreditfrage.",
  },
  {
    id: "t2",
    priorityLabel: "Hoch",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.25)",
    color: "var(--amber)",
    text: "Abos prüfen: Liste alle laufenden Abos (Streaming, Apps, Mitgliedschaften) auf. Ein nicht genutztes Abo weniger spart oft 50–150 € pro Jahr.",
  },
  {
    id: "t3",
    priorityLabel: "Hoch",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.25)",
    color: "var(--amber)",
    text: "Sparen automatisieren: Richte einen Dauerauftrag direkt nach dem Gehaltseingang ein. Geld, das gar nicht erst auf dem Girokonto sichtbar ist, wird auch nicht ausgegeben.",
  },
  {
    id: "t4",
    priorityLabel: "Mittel",
    bg: "rgba(77,159,255,0.08)",
    border: "rgba(77,159,255,0.25)",
    color: "var(--blue)",
    text: "Tagesgeldzinsen vergleichen: Banken passen ihre Zinsen regelmäßig an. Ein Vergleich alle 6 Monate kann sich spürbar rechnen.",
  },
  {
    id: "t5",
    priorityLabel: "Mittel",
    bg: "rgba(77,159,255,0.08)",
    border: "rgba(77,159,255,0.25)",
    color: "var(--blue)",
    text: "Variables Budget in bar: Wenn das Bargeld weg ist, ist es weg. Diese harte Grenze schützt besser vor Impulskäufen als jede Kontoabfrage.",
  },
  {
    id: "t6",
    priorityLabel: "Langfristig",
    bg: "rgba(157,108,255,0.08)",
    border: "rgba(157,108,255,0.25)",
    color: "var(--purple)",
    text: "ETF-Sparplan: Setze auf breite, kostengünstige Welt-ETFs (z.B. MSCI World oder FTSE All-World). Zeit im Markt schlägt das Timing des Markts.",
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
