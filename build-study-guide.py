#!/usr/bin/env python3
"""
build-study-guide.py — regenerates analytics-modeling-study-guide.pdf.

Run it from the site folder after editing any module or cram sheet:

    python3 build-study-guide.py            # writes the .html print source and the .pdf
    python3 build-study-guide.py --html     # print source only

Content is read from the site itself, so there is nothing to keep in sync:
  * module list, titles and colours   <- MODULES in study.js
  * the cram sheets                   <- window.CRAM in index.html
  * transfer practice (exam targets)  <- <section id="targets"> on each module page

Rendering: wkhtmltopdf with unpatched Qt. That engine has no CSS variables,
flexbox or grid and maps units oddly, so the layout is plain absolute
positioning on fixed 1063 x 1503 px pages (A4 at this engine's scale;
1pt on paper = 1.786 css px). A small ES5 script flows the content blocks
into two fixed-height columns per page before the PDF is printed, and
records any block that overflows its column in <body data-overflow>.
Command used:

    wkhtmltopdf --page-size A4 -T 0 -B 0 -L 0 -R 0 in.html out.pdf
"""

import re, sys, html, subprocess, datetime, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_HTML = os.path.join(HERE, "analytics-modeling-study-guide.html")
OUT_PDF = os.path.join(HERE, "analytics-modeling-study-guide.pdf")


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------- sources
def modules():
    js = read("study.js")
    block = js[js.index("var MODULES = ["):js.index("];", js.index("var MODULES = ["))]
    block = re.sub(r"/\*.*?\*/", "", block, flags=re.S)       # drop commented-out entries
    out = []
    for m in re.finditer(r"\{([^{}]*)\}", block, re.S):
        body = m.group(1)
        get = lambda k: (re.search(k + r'\s*:\s*"((?:[^"\\]|\\.)*)"', body) or [None, None])[1]
        out.append(dict(id=get("id"), file=get("file"), title=get("title"),
                        colour=get("colour"), label=get("label"), blurb=get("blurb")))
    return out


def cram():
    s = read("index.html")
    start = s.index("window.CRAM = {")
    end = s.index("\n};", start)
    return {k: v for k, v in re.findall(r"\n(\w+): `(.*?)`", s[start:end], re.S)}


def targets(page):
    s = read(page)
    m = re.search(r'<section[^>]*id="targets"[^>]*>(.*?)</section>', s, re.S)
    if not m:
        return []
    out = []
    for a in re.findall(r'<aside class="check">(.*?)</aside>', m.group(1), re.S):
        q = re.search(r'<p class="q">(.*?)</p>', a, re.S).group(1).strip()
        ans = [x.strip() for x in re.findall(r'<p class="a">(.*?)</p>', a, re.S)]
        out.append((q, ans))
    return out


# ---------------------------------------------------------------- blocks
def split_cram(htm):
    """Cut a cram sheet into flowable blocks: each <li> is a block, and each
    <h4> is glued to the first item after it so a heading never ends a column."""
    blocks, pending = [], None
    pos = 0
    for m in re.finditer(r"<h4>(.*?)</h4>|<ul([^>]*)>(.*?)</ul>", htm, re.S):
        if m.group(1) is not None:
            pending = '<h4>%s</h4>' % m.group(1)
            continue
        cls = re.search(r'class="([^"]+)"', m.group(2) or "")
        cls = cls.group(1) if cls else ""
        for li in re.findall(r"<li>(.*?)</li>", m.group(3), re.S):
            item = '<ul class="%s"><li>%s</li></ul>' % (cls, li.strip())
            blocks.append((pending or "") + item)
            pending = None
    return blocks


def module_blocks(m, idx, cram_html, tgts):
    colour = m["colour"] or "#131b26"
    cap = m["label"] or ("Module %d" % idx)
    head = ('<div class="mhead" style="border-color:%s">'
            '<div class="mnum" style="color:%s">%s</div>'
            '<h1>%s</h1><p class="blurb">%s</p></div>') % (
        colour, colour, html.escape(cap), m["title"], m["blurb"])
    flow = ['<div class="sect" style="color:%s">Cram sheet</div>' % colour + b
            if i == 0 else b for i, b in enumerate(split_cram(cram_html))]
    if tgts:
        for i, (q, ans) in enumerate(tgts):
            blk = ('<div class="tq"><span class="tn" style="color:%s">Target %d</span>'
                   '<p class="q">%s</p>%s</div>') % (
                colour, i + 1, q, "".join('<p class="a">%s</p>' % a for a in ans))
            if i == 0:
                blk = ('<div class="sect" style="color:%s">Transfer practice'
                       ' &mdash; same ideas, unfamiliar settings</div>' % colour) + blk
            flow.append(blk)
    return dict(id=m["id"], title=m["title"], cap=cap, colour=colour, head=head, flow=flow)


# ---------------------------------------------------------------- page
CSS = r"""
@page{size:A4;margin:0}
html,body{margin:0;padding:0;background:#fff}
body{font-family:"IBM Plex Sans","DejaVu Sans",Arial,sans-serif;color:#131b26;font-size:15px;line-height:1.42;
     -webkit-print-color-adjust:exact}
#src{display:none}
.page{position:relative;width:1063px;height:1503px;overflow:hidden;page-break-after:always;background:#fff}
.page.last{page-break-after:auto}
.rh{position:absolute;left:76px;right:76px;top:40px;height:20px;border-bottom:1px solid #c9d2db;
    font-size:12px;color:#4a5765;letter-spacing:.04em;text-transform:uppercase}
.rh b{font-weight:600}
.rh .r{position:absolute;right:0;top:0}
.pf{position:absolute;left:76px;right:76px;bottom:38px;height:18px;font-size:12px;color:#4a5765}
.pf .r{position:absolute;right:0;top:0}
.body{position:absolute;left:76px;right:76px;top:84px;bottom:76px}
.full{position:relative;width:911px}
.col{position:absolute;top:0;width:437px;overflow:hidden}
.col.c0{left:0}.col.c1{left:474px}
.rule{position:absolute;left:455px;top:0;bottom:0;width:1px;background:#e3e9ee}

/* module header */
.mhead{border-top:7px solid #131b26;padding:18px 0 16px;margin:0 0 20px;border-bottom:1px solid #c9d2db}
.mnum{font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:14px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.mhead h1{font-family:"IBM Plex Serif","DejaVu Serif",Georgia,serif;font-size:44px;line-height:1.08;margin:0 0 10px;font-weight:600}
.mhead .blurb{font-family:"IBM Plex Serif","DejaVu Serif",Georgia,serif;font-style:italic;font-size:17px;color:#4a5765;margin:0;max-width:820px}

/* flowed content */
.blk{padding:0 0 6px}
.sect{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid currentColor;
      padding-bottom:3px;margin:4px 0 8px}
h4{font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
   color:#4a5765;margin:10px 0 5px;padding-bottom:2px;border-bottom:1px solid #e3e9ee}
ul{margin:0;padding:0;list-style:none}
li{margin:0;padding-left:12px;text-indent:-12px}
li:before{content:"\00B7";font-weight:700;margin-right:6px;color:#4a5765}
b{font-weight:600}
i{font-style:italic;color:#4a5765}
.warn{color:#9d3b3b;font-weight:600}
ul.eqs li{font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:13.4px;line-height:1.4;background:#f1f4f7;
          border-left:3px solid #9aa5b1;padding:5px 8px;text-indent:0;word-wrap:break-word}
ul.eqs li:before{content:none}
ul.eqs li i{display:block;font-family:"IBM Plex Sans","DejaVu Sans",Arial,sans-serif;font-style:normal;font-size:12.5px}
ul.knob li b{font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-weight:500}
.tq{border-left:3px solid #c9d2db;padding:2px 0 2px 10px}
.tq .tn{display:block;font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}
.tq .q{font-weight:600;margin:2px 0 4px}
.tq .a{margin:0 0 4px;color:#26313d}
.tq p{margin:0}

/* cover */
.cover .body{top:170px}
.cover h1{font-family:"IBM Plex Serif","DejaVu Serif",Georgia,serif;font-size:72px;line-height:1.02;margin:0 0 16px;font-weight:600}
.cover .sub{font-family:"IBM Plex Serif","DejaVu Serif",Georgia,serif;font-style:italic;font-size:22px;color:#4a5765;margin:0 0 50px;max-width:760px}
.bar{height:10px;margin:0 0 56px;overflow:hidden}
.bar span{float:left;height:10px}
.toc{width:100%;border-collapse:collapse;font-size:17px}
.toc td{padding:10px 0;border-bottom:1px solid #e3e9ee;vertical-align:top}
.toc .n{width:140px;font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:14px;padding-top:12px}
.toc .p{width:60px;text-align:right;font-family:"IBM Plex Mono","DejaVu Sans Mono",monospace;font-size:15px}
.toc .t b{font-weight:600}
.toc .t span{display:block;font-size:13.5px;color:#4a5765;margin-top:2px}
.note{position:absolute;left:76px;right:76px;bottom:90px;font-size:13px;color:#4a5765;border-top:1px solid #c9d2db;padding-top:14px}
.note b{color:#131b26}
"""

JS = r"""
(function(){
  var W_BODY = 1503 - 84 - 76;              /* usable height of .body */
  var src = document.getElementById('src');
  var mods = src.children;
  var pages = [], overflow = [];
  var cover = document.getElementById('cover');
  var total = 0;

  function newPage(mod){
    var p = document.createElement('div');
    p.className = 'page';
    p.innerHTML = '<div class="rh"><b>Analytics Modeling</b> &nbsp;&middot;&nbsp; Study guide' +
                  '<span class="r"></span></div><div class="body"></div><div class="pf"><span class="l"></span><span class="r"></span></div>';
    var cap = mod.getAttribute('data-cap'), ttl = mod.getAttribute('data-title');
    p.querySelector('.rh .r').innerHTML = (cap === ttl) ? ttl : cap + ' &mdash; ' + ttl;
    document.body.appendChild(p);
    pages.push(p);
    return p;
  }
  function addCols(p, top){
    var b = p.querySelector('.body');
    var h = W_BODY - top;
    var r = document.createElement('div'); r.className = 'rule';
    r.style.top = top + 'px'; b.appendChild(r);
    var cols = [];
    for (var i = 0; i < 2; i++){
      var c = document.createElement('div');
      c.className = 'col c' + i;
      c.style.top = top + 'px';
      c.style.height = h + 'px';
      b.appendChild(c);
      cols.push(c);
    }
    return cols;
  }

  var tocPages = {};
  for (var m = 0; m < mods.length; m++){
    var mod = mods[m];
    var p = newPage(mod);
    tocPages[mod.getAttribute('data-id')] = pages.length + 1;   /* +1 for the cover */
    var body = p.querySelector('.body');
    var head = mod.querySelector('.h');
    var full = document.createElement('div'); full.className = 'full';
    full.innerHTML = head.innerHTML;
    body.appendChild(full);
    var cols = addCols(p, full.offsetHeight), ci = 0;
    var blocks = mod.querySelectorAll('.f');
    for (var k = 0; k < blocks.length; k++){
      var el = document.createElement('div');
      el.className = 'blk';
      el.innerHTML = blocks[k].innerHTML;
      cols[ci].appendChild(el);
      if (cols[ci].scrollHeight > cols[ci].clientHeight){
        cols[ci].removeChild(el);
        ci++;
        if (ci > 1){ p = newPage(mod); cols = addCols(p, 0); ci = 0; }
        cols[ci].appendChild(el);
        if (cols[ci].scrollHeight > cols[ci].clientHeight)
          overflow.push(mod.getAttribute('data-id') + ':' + k);
      }
    }
  }
  src.parentNode.removeChild(src);
  total = pages.length + 1;
  for (var i = 0; i < pages.length; i++){
    pages[i].querySelector('.pf .r').innerHTML = (i + 2) + ' / ' + total;
    pages[i].querySelector('.pf .l').innerHTML = document.body.getAttribute('data-built');
  }
  pages[pages.length - 1].className += ' last';
  var cells = document.querySelectorAll('.toc .p');
  for (var j = 0; j < cells.length; j++) cells[j].innerHTML = tocPages[cells[j].getAttribute('data-id')] || '';
  document.body.setAttribute('data-pages', String(total));
  document.body.setAttribute('data-overflow', overflow.join(' '));
  if (overflow.length){
    var w = document.createElement('div');
    w.style.cssText = 'position:absolute;left:76px;top:100px;color:#fff;background:#9d3b3b;padding:6px 10px;font-size:14px';
    w.innerHTML = 'OVERFLOW (block taller than a column): ' + overflow.join(', ');
    cover.appendChild(w);
  }
})();
"""


def build():
    mods = modules()
    cr = cram()
    built = "Built " + datetime.date.today().strftime("%d %B %Y").lstrip("0")
    src, toc, bar = [], [], []
    n_lecture = 0
    for m in mods:
        if m["id"] not in cr:
            continue
        if not m["label"]:
            n_lecture += 1
        idx = n_lecture
        tg = targets(m["file"]) if m["file"].startswith("module-") else []
        mb = module_blocks(m, idx, cr[m["id"]], tg)
        src.append('<div data-id="%s" data-cap="%s" data-title="%s"><div class="h">%s</div>%s</div>' % (
            mb["id"], html.escape(mb["cap"]), html.escape(re.sub("<[^>]+>", "", mb["title"])),
            mb["head"], "".join('<div class="f">%s</div>' % b for b in mb["flow"])))
        toc.append('<tr><td class="n" style="color:%s">%s</td><td class="t"><b>%s</b><span>%s</span></td>'
                   '<td class="p" data-id="%s"></td></tr>' % (
                       mb["colour"], html.escape(mb["cap"]), mb["title"],
                       "Cram sheet" + (" &middot; %d transfer targets" % len(tg) if tg else ""), mb["id"]))
        bar.append('<span style="width:%.3f%%;background:%s"></span>' % (0, mb["colour"]))
    w = 100.0 / len(bar)
    bar = [b.replace("width:0.000%", "width:%.3f%%" % w) for b in bar]

    cover = ('<div class="page cover" id="cover"><div class="body">'
             '<h1>Analytics Modeling</h1>'
             '<p class="sub">Study guide &mdash; every module&rsquo;s cram sheet (terms, equations, what each parameter does, '
             'the rules that carry marks), followed by its transfer-practice exam targets.</p>'
             '<div class="bar">%s</div><table class="toc">%s</table></div>'
             '<div class="note"><b>Written by an AI model from lecture recordings.</b> Not reviewed by any instructor or '
             'institution; examples are generic illustrations rather than the ones used in class. Verify anything you rely on '
             'against the original lectures. Generated from the study-notes site by build-study-guide.py &middot; %s.</div>'
             '</div>') % ("".join(bar), "".join(toc), built)

    page = ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            '<title>Analytics Modeling &mdash; Study guide</title>'
            '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600'
            '&family=IBM+Plex+Serif:ital,wght@0,600;1,400&display=swap" rel="stylesheet">'
            '<style>%s</style></head><body data-built="%s">%s<div id="src">%s</div><script>%s</script></body></html>') % (
        CSS, built, cover, "".join(src), JS)
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(page)
    print("wrote", os.path.basename(OUT_HTML))


if __name__ == "__main__":
    build()
    if "--html" not in sys.argv:
        if os.path.exists(OUT_PDF):
            os.remove(OUT_PDF)
        r = subprocess.run(["wkhtmltopdf", "--page-size", "A4", "-T", "0", "-B", "0", "-L", "0", "-R", "0",
                            OUT_HTML, OUT_PDF])
        if not os.path.exists(OUT_PDF):
            sys.exit("wkhtmltopdf failed (exit %d)" % r.returncode)
        if r.returncode:
            # Exit 1 with a PDF on disk is almost always the Google Fonts request failing
            # offline; the page then renders in the DejaVu fallbacks.
            print("note: wkhtmltopdf exited %d (usually fonts unreachable offline); PDF written anyway" % r.returncode)
        print("wrote", os.path.basename(OUT_PDF))
