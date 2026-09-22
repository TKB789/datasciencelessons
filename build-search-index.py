#!/usr/bin/env python3
"""
build-search-index.py — regenerates search-index.js from the site's pages.

Run it from the site folder after editing any page:

    python3 build-search-index.py

It walks every .html file, pulls the visible text out of each <section>,
and writes one entry per section. exam-prep.html is handled separately
because its questions live in a JavaScript array rather than in markup.

Sections without an id get one written back into the file, so that search
results can link to them.
"""

import re, os, json, glob, html as htmllib

SKIP_FILES = {"search-index.js", "analytics-modeling-study-guide.html"}

PAGE_TITLES = {
    "index.html": "Home",
    "discussion.html": "Discussion: Instructor's Notes",
    "exam-prep.html": "Exam practice",
}

TAG = re.compile(r"<[^>]+>")
SCRIPT = re.compile(r"<script\b.*?</script>", re.S | re.I)
STYLE = re.compile(r"<style\b.*?</style>", re.S | re.I)
SVG = re.compile(r"<svg\b.*?</svg>", re.S | re.I)
WS = re.compile(r"\s+")


def text_of(fragment: str) -> str:
    """Visible text of an HTML fragment, with scripts, styles and svg dropped."""
    s = SCRIPT.sub(" ", fragment)
    s = STYLE.sub(" ", s)
    s = SVG.sub(" ", s)
    s = TAG.sub(" ", s)
    s = htmllib.unescape(s)
    return WS.sub(" ", s).strip()


def page_title(path: str, src: str) -> str:
    if path in PAGE_TITLES:
        return PAGE_TITLES[path]
    m = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S)
    if m:
        return text_of(m.group(1))
    m = re.search(r"<title[^>]*>(.*?)</title>", src, re.S)
    return text_of(m.group(1)) if m else path


def ensure_section_ids(path: str, src: str):
    """Give every <section> an id so results can deep-link. Returns new source."""
    changed = False
    out, at, n = [], 0, 0
    for m in re.finditer(r"<section\b([^>]*)>", src):
        n += 1
        attrs = m.group(1)
        if "id=" in attrs:
            continue
        new = f'<section id="sec-{n}"{attrs}>'
        out.append(src[at:m.start()])
        out.append(new)
        at = m.end()
        changed = True
    if not changed:
        return src, False
    out.append(src[at:])
    return "".join(out), True


def sections_of(src: str):
    """Yield (id, heading, own-text) per <section>, excluding nested sections.

    A simple depth scan rather than a regex, so that an appendix containing
    lesson sections is not indexed twice over.
    """
    opens = [(m.start(), m.end(), m.group(0)) for m in re.finditer(r"<section\b[^>]*>", src)]
    closes = [m.start() for m in re.finditer(r"</section>", src)]
    events = [(p, "o", i) for i, (p, _e, _t) in enumerate(opens)] + [(p, "c", -1) for p in closes]
    events.sort()

    spans, stack = [], []
    for pos, kind, idx in events:
        if kind == "o":
            stack.append((idx, opens[idx][1]))
        elif stack:
            idx, body_start = stack.pop()
            spans.append((idx, body_start, pos, len(stack)))

    # child body ranges, so a parent can exclude them
    starts = sorted((opens[i][0], end) for i, _b, end, _d in spans)

    for idx, body_start, body_end, _depth in sorted(spans, key=lambda s: s[1]):
        tag = opens[idx][2]
        m = re.search(r'id="([^"]+)"', tag)
        if not m:
            continue
        sid = m.group(1)
        body = src[body_start:body_end]

        # strip any nested sections out of this section's own text
        own = re.sub(r"<section\b[^>]*>.*?</section>", " ", body, flags=re.S)
        while "<section" in own:
            own = re.sub(r"<section\b[^>]*>.*", " ", own, flags=re.S)

        h = re.search(r"<h([1-3])[^>]*>(.*?)</h\1>", own, re.S)
        heading = text_of(h.group(2)) if h else ""
        body_text = text_of(own)
        if len(body_text) < 60:
            continue
        yield sid, heading, body_text


def exam_prep_entries(src: str):
    """exam-prep.html builds itself from a MODULES array; read that instead."""
    entries = []
    start = src.find("const MODULES = [")
    if start == -1:
        return entries
    blob = src[start:]
    for topic in re.finditer(
        r'\{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*blurb:\s*"([^"]*)",\s*questions:\s*\[(.*?)\n    \]\s*\}',
        blob, re.S,
    ):
        tid, title, blurb, qs = topic.groups()
        chunks = [title, blurb]
        for field in re.finditer(r'(?:text|why|answer):\s*"((?:[^"\\]|\\.)*)"', qs):
            raw = field.group(1).encode().decode("unicode_escape", "ignore")
            chunks.append(text_of(raw))
        for opts in re.finditer(r"options:\s*\[(.*?)\]", qs, re.S):
            for o in re.finditer(r'"((?:[^"\\]|\\.)*)"', opts.group(1)):
                chunks.append(o.group(1).encode().decode("unicode_escape", "ignore"))
        entries.append({"id": tid, "h": title, "t": WS.sub(" ", " ".join(chunks)).strip()})
    return entries


def index_html_entries(src: str):
    """index.html holds its cram sheets in a CRAM object in an inline script."""
    entries = []
    m = re.search(r"window\.CRAM\s*=\s*\{(.*?)\n\};", src, re.S)
    if not m:
        return entries
    for block in re.finditer(r"\n(\w+):\s*`(.*?)`", m.group(1), re.S):
        key, body = block.groups()
        head = re.search(r"<h4>(.*?)</h4>", body, re.S)
        entries.append({
            "id": "",
            "h": "Cram sheet — " + (text_of(head.group(1)) if head else key),
            "t": text_of(body),
        })
    return entries


def main():
    pages = []
    for path in sorted(glob.glob("*.html")):
        src = open(path, encoding="utf-8").read()
        src, rewritten = ensure_section_ids(path, src)
        if rewritten:
            open(path, "w", encoding="utf-8").write(src)
            print(f"  + added section ids to {path}")

        secs = []
        if path == "exam-prep.html":
            secs = exam_prep_entries(src)
        elif path == "index.html":
            secs = index_html_entries(src)
        else:
            for sid, heading, body in sections_of(src):
                secs.append({"id": sid, "h": heading, "t": body})

        if not secs:
            continue
        pages.append({"f": path, "t": page_title(path, src), "s": secs})

    payload = {"built": None, "pages": pages}
    js = "window.SEARCH_INDEX=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
    open("search-index.js", "w", encoding="utf-8").write(js)

    words = sum(len(s["t"].split()) for p in pages for s in p["s"])
    print(f"search-index.js: {len(pages)} pages, "
          f"{sum(len(p['s']) for p in pages)} sections, "
          f"{words:,} words, {os.path.getsize('search-index.js')/1024:.0f} KB")


if __name__ == "__main__":
    main()
