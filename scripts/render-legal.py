#!/usr/bin/env python3
# =============================================================================
# render-legal.py — rendert die Rechtstexte (docs/legal-texts/*.txt) zu
# statischen HTML-Seiten im Site-Stil (impressum.html / datenschutz.html /
# agb.html im Projekt-Root).
#
# KEIN Runtime-Build — reines Dev-Hilfsskript. Nach jeder Textänderung
# einmal ausführen:  python scripts/render-legal.py
# =============================================================================

import re
import html

FILES = [
    ("docs/legal-texts/impressum.txt",   "impressum.html",   "Impressum",   "impressum"),
    ("docs/legal-texts/datenschutz.txt", "datenschutz.html", "Datenschutz", "datenschutz"),
    ("docs/legal-texts/agb.txt",         "agb.html",         "AGB",         "agb"),
]

DASH    = re.compile(r"^-{3,}$")
SUBHEAD = re.compile(r"^[a-z]\)\s")
ENUM    = re.compile(r"^\(\d+\)\s")
LABEL   = re.compile(r"^[A-ZÄÖÜ][\wäöüÄÖÜß.\-]*:\s")
EMAIL   = re.compile(r"([\w.+-]+@[\w-]+\.[\w.-]+)")


def esc(s):
    return html.escape(s, quote=False)


def linkify(s):
    return EMAIL.sub(r'<a href="mailto:\1">\1</a>', s)


def join_lines(lines):
    """Fügt umbrochene Prosa-Zeilen zusammen. Endet eine Zeile auf '-'
    (weiche Worttrennung) und die nächste beginnt klein → Bindestrich
    entfernen und ohne Leerzeichen verbinden; bei Großbuchstabe als
    echter Kompositum-Strich ohne Leerzeichen belassen (z. B. Free-Tier)."""
    res = ""
    for ln in lines:
        if not res:
            res = ln
        elif res.endswith("-"):
            if len(res) >= 2 and res[-2].isalpha() and ln[:1].islower():
                res = res[:-1] + ln
            else:
                res = res + ln
        else:
            res = res + " " + ln
    return res


def strip_trailer(text):
    idx = text.find("Hinweis für Claude Code")
    if idx != -1:
        text = text[:idx]
    lines = text.split("\n")
    # trailing Leer- und Trennstrich-Zeilen (Separator vor dem Hinweis) entfernen
    while lines and (lines[-1].strip() == "" or DASH.match(lines[-1].strip())):
        lines.pop()
    return "\n".join(lines).strip("\n")


def is_address_like(run):
    if len(run) < 2:
        return False
    if any(l.lstrip().startswith("- ") for l in run):
        return False
    return max(len(l) for l in run) < 46


def render_run(run):
    out = []
    if is_address_like(run):
        body = "<br>".join(linkify(esc(l)) for l in run)
        out.append('<address class="legal-addr">' + body + "</address>")
        return out

    para = []

    def flush():
        if para:
            out.append("<p>" + linkify(esc(join_lines(para))) + "</p>")
            para.clear()

    i = 0
    while i < len(run):
        ln = run[i]
        s = ln.strip()
        if s.startswith("- "):
            flush()
            items = []
            while i < len(run) and run[i].strip().startswith("- "):
                items.append(linkify(esc(run[i].strip()[2:])))
                i += 1
            out.append("<ul>" + "".join("<li>%s</li>" % it for it in items) + "</ul>")
            continue
        if SUBHEAD.match(ln):
            flush()
            out.append("<h3>%s</h3>" % esc(ln))
            i += 1
            continue
        if ENUM.match(ln) or LABEL.match(ln):
            flush()
            para.append(ln)
            i += 1
            continue
        para.append(ln)
        i += 1
    flush()
    return out


def render_body(text):
    text = strip_trailer(text)
    blocks, cur = [], []
    for ln in text.split("\n"):
        if ln.strip() == "":
            if cur:
                blocks.append(cur); cur = []
        else:
            cur.append(ln.rstrip())
    if cur:
        blocks.append(cur)

    out = []
    if blocks:
        first = blocks.pop(0)
        out.append("<h1>%s</h1>" % esc(first[0]))
        for extra in first[1:]:
            out.append('<p class="legal-stand">%s</p>' % esc(extra))

    for blk in blocks:
        if all(DASH.match(l.strip()) for l in blk):
            continue  # reiner Trennstrich-Block — überspringen
        if len(blk) >= 2 and DASH.match(blk[1].strip()):
            out.append("<h2>%s</h2>" % esc(blk[0]))
            if blk[2:]:
                out.extend(render_run(blk[2:]))
        else:
            out.extend(render_run(blk))
    return "\n      ".join(out)


TEMPLATE = """<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>%%TITLE%% · Finanz-Cockpit</title>
  <meta name="robots" content="index, follow">
  <script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('fc-theme')||'dark')}catch(e){}</script>
  <link rel="stylesheet" href="css/fonts.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/legal.css">
</head>
<body>

<header class="legal-topbar">
  <a class="legal-wordmark" href="index.html">Finanz<span class="amp">·</span>Cockpit</a>
  <div class="legal-actions">
    <button class="legal-theme-btn" id="legal-theme-btn" type="button" aria-label="Theme wechseln" onclick="fcLegalToggleTheme()">🌙</button>
    <a class="legal-back" href="app.html">Zurück zur App</a>
  </div>
</header>

<main class="legal-content">
      %%BODY%%
</main>

<footer class="legal-footer">
  <a href="impressum.html"%%CUR_IMPRESSUM%%>Impressum</a>
  <span class="legal-footer-sep">·</span>
  <a href="datenschutz.html"%%CUR_DATENSCHUTZ%%>Datenschutz</a>
  <span class="legal-footer-sep">·</span>
  <a href="agb.html"%%CUR_AGB%%>AGB</a>
  <span class="legal-footer-sep">·</span>
  <a href="app.html">Zur App</a>
  <span class="legal-footer-copy">© 2026 Finanz·Cockpit</span>
</footer>

<script>
  function fcLegalToggleTheme(){
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('fc-theme', next); } catch(e) {}
    document.getElementById('legal-theme-btn').textContent = next === 'dark' ? '☀️' : '🌙';
  }
  (function(){
    var t = document.documentElement.getAttribute('data-theme');
    document.getElementById('legal-theme-btn').textContent = t === 'dark' ? '☀️' : '🌙';
  })();
</script>

</body>
</html>
"""


def build(short_title, body_html, key):
    out = (TEMPLATE
           .replace("%%TITLE%%", short_title)
           .replace("%%BODY%%", body_html)
           .replace("%%CUR_IMPRESSUM%%",   ' aria-current="page"' if key == "impressum"   else "")
           .replace("%%CUR_DATENSCHUTZ%%", ' aria-current="page"' if key == "datenschutz" else "")
           .replace("%%CUR_AGB%%",         ' aria-current="page"' if key == "agb"         else ""))
    return out


def main():
    for src, out, title, key in FILES:
        with open(src, encoding="utf-8") as f:
            text = f.read()
        body = render_body(text)
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(build(title, body, key))
        print("OK  %s -> %s" % (src, out))


if __name__ == "__main__":
    main()
