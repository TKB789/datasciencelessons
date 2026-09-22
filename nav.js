/* ============================================================
   nav.js — makes the module navigation usable on a phone.

   The topbar holds eleven module pills, a toolbar and a progress
   rail. On a narrow screen the pills wrap to four rows, and since
   the topbar is position:sticky that whole block follows you down
   the page and covers most of it.

   Three standard fixes, all mobile-only. The desktop layout is
   untouched.

     1. The pills become a single horizontally scrolling strip,
        auto-centred on the module you are in.
     2. Once you scroll past the header the topbar tucks itself
        away, leaving a compact chip naming the current module.
        Tapping the chip brings the full navigation back.
     3. The rail and toolbar ride along with the tuck.

   Loaded on every page; it exits immediately where there is no
   topbar, so exam-prep.html is unaffected.
   ============================================================ */
(function () {
  "use strict";

  function start() {

  var bar = document.querySelector(".topbar");
  if (!bar) return;

  var tabs = bar.querySelector(".tabs");

  /* study.js fills .tabs on DOMContentLoaded. Rather than depend on which
     listener fires first, the current pill is looked up again each time it
     is needed, and the chip re-labels itself once it appears. */
  function currentTab() {
    if (!tabs) return null;
    return tabs.querySelector('[aria-current="page"]') || tabs.querySelector("a");
  }

  /* ---------- compact chip shown while tucked ---------- */
  var chip = document.createElement("div");
  chip.className = "navchip";

  var openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "navnow";
  openBtn.setAttribute("aria-expanded", "false");

  openBtn.innerHTML =
    '<span class="navdot"></span><span class="navlbl">Modules</span><span class="navcar">\u25BE</span>';

  function relabel() {
    var a = currentTab();
    if (!a) return;
    openBtn.querySelector(".navlbl").textContent = a.textContent.replace(/\s+/g, " ").trim();
    var colour = (a.style.getPropertyValue("--c") || "").trim();
    if (colour) openBtn.querySelector(".navdot").style.background = colour;
  }

  chip.appendChild(openBtn);

  /* while tucked the search bar is hidden, so the chip carries a way back to it */
  var findBtn = document.createElement("button");
  findBtn.type = "button";
  findBtn.className = "navfind";
  findBtn.setAttribute("aria-label", "Search");
  findBtn.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true" width="15" height="15">' +
    '<circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M11 11l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  chip.appendChild(findBtn);

  bar.insertBefore(chip, bar.firstChild);

  /* ---------- centre the current pill in the strip ---------- */
  function centreActive() {
    var a = currentTab();
    if (!tabs || !a) return;
    if (tabs.scrollWidth <= tabs.clientWidth + 4) return;   /* not scrolling: desktop */
    var want = a.offsetLeft - tabs.clientWidth / 2 + a.offsetWidth / 2;
    tabs.scrollLeft = Math.max(0, want);
  }

  function refresh() { relabel(); centreActive(); }

  /* ---------- tuck on scroll ---------- */
  var TUCK_AT = 150;      /* start tucking once the header is behind you */
  var SHOW_AT = 60;       /* fully expand again near the top */
  var REOPEN = 140;       /* scrolling this far after a manual open re-tucks */
  var manualY = null;     /* where the reader opened it by hand */
  var ticking = false;

  function apply() {
    ticking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop;

    if (manualY !== null) {
      if (y > manualY + REOPEN || y < SHOW_AT) manualY = null;
      else return;                                   /* leave it open */
    }
    var tuck = y > TUCK_AT;
    if (tuck === bar.classList.contains("tucked")) return;
    bar.classList.toggle("tucked", tuck);
    openBtn.setAttribute("aria-expanded", String(!tuck));
    if (!tuck) refresh();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  openBtn.addEventListener("click", function () {
    bar.classList.remove("tucked");
    openBtn.setAttribute("aria-expanded", "true");
    manualY = window.pageYOffset || document.documentElement.scrollTop;
    refresh();
  });

  findBtn.addEventListener("click", function () {
    bar.classList.remove("tucked");
    manualY = window.pageYOffset || document.documentElement.scrollTop;
    var input = document.querySelector(".sr-input");
    if (input) { input.focus(); input.select(); }
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", centreActive);

  /* the rail is built by study.js after DOMContentLoaded, so wait a beat */
  refresh();
  setTimeout(refresh, 60);     /* after study.js has built the pills */
  setTimeout(refresh, 400);    /* and once more once fonts have settled */
  apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 0); });
  } else {
    start();
  }
})();
