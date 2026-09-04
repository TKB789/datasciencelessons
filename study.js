/* ============================================================
   Analytics modeling study notes — shared behaviour
   Loaded by index.html and every module-*.html page.

   >>> TO ADD A MODULE: add one line to MODULES below and drop the new
   >>> page in the same folder. Nothing else needs editing — the tab bar
   >>> and the index cards both build themselves from this list.
   >>> module-template.html is a starting point you can copy.
   ============================================================ */

var MODULES = [
  { id:"m1", file:"module-1-introduction.html", tab:"Module 1 — Foundations",
    title:"Foundations", colour:"#7a3f52",
    blurb:"The three kinds of question analytics answers, how the topics fit together, and the one word that means three different things." },

  { id:"m2", file:"module-2-classification.html", tab:"Module 2 — Classification",
    title:"Classification", colour:"#33507f",
    blurb:"Sorting things into categories: choosing the best boundary, the maths of support vector machines, scaling, and k-nearest neighbours." },

  { id:"m3", file:"module-3-validation.html", tab:"Module 3 — Validation",
    title:"Validation", colour:"#1f6b6b",
    blurb:"Why training accuracy lies, how training / validation / test split the work, and what k-fold cross-validation buys you." },

  { id:"m4", file:"module-4-clustering.html", tab:"Module 4 — Clustering",
    title:"Clustering", colour:"#1b5e7e",
    blurb:"Grouping similar points, measuring what “close” means, running k-means, and telling clustering apart from classification." }

  /* , { id:"m5", file:"module-5-something.html", tab:"Module 5 — Title",
       title:"Title", colour:"#8a5a1c", blurb:"One line about the module." } */
];

(function(){
  "use strict";

  var KEY = "analytics-study-notes-v1";
  var OLD_KEY = "isye6501-study-v3";   /* migrated once, then ignored */
  var canStore = true;
  var HERE = (document.body.getAttribute("data-page") || "");

  /* ---------------- storage ---------------- */
  function read(){
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch(e){ canStore = false; return {}; }
  }
  function write(o){
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch(e){ canStore = false; return false; }
  }
  var STATE = read();
  /* one-time migration from the previous storage key */
  if (!STATE.notes && !STATE.done){
    try {
      var legacy = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (legacy && (legacy.notes || legacy.done)) STATE = legacy;
    } catch(e){ /* nothing to migrate */ }
  }
  if (!STATE.notes) STATE.notes = {};
  if (!STATE.done)  STATE.done  = {};

  function save(){
    if (!write(STATE)) toast("Storage is blocked here — use Export to keep a copy.");
  }
  function markDone(id){
    if (!id || STATE.done[id]) return;
    STATE.done[id] = 1; save(); refreshProgress();
  }
  function isDone(id){ return !!STATE.done[id]; }

  function toast(msg){
    var s = document.getElementById("dlgStatus");
    if (!s) return;
    s.textContent = msg;
    setTimeout(function(){ s.textContent = ""; }, 3600);
  }

  /* ---------------- navigation ---------------- */
  function buildNav(){
    var tabs = document.querySelector(".tabs");
    if (!tabs) return;
    var html = '<a href="index.html" style="--c:#131b26"' +
               (HERE === "index" ? ' aria-current="page"' : '') + '>All modules</a>';
    MODULES.forEach(function(m){
      var pre = m.tab.split("—")[0].trim();          /* e.g. "Module 2" */
      html += '<a href="' + m.file + '" style="--c:' + m.colour + '"' +
              (HERE === m.id ? ' aria-current="page"' : '') + '>' +
              '<span class="tpre">' + pre + ' &middot;&nbsp;</span>' +
              '<span class="ttitle">' + m.title + '</span></a>';
    });
    tabs.innerHTML = html;
  }

  /* ---------------- notes ---------------- */
  function initNotes(){
    var boxes = document.querySelectorAll(".note-body");
    Array.prototype.forEach.call(boxes, function(b){
      var id = b.getAttribute("data-note");
      if (id && STATE.notes[id]) b.textContent = STATE.notes[id];
    });
    var t = null;
    document.addEventListener("input", function(e){
      var box = e.target.closest ? e.target.closest(".note-body") : null;
      if (!box) return;
      clearTimeout(t);
      t = setTimeout(function(){
        Array.prototype.forEach.call(document.querySelectorAll(".note-body"), function(b){
          var id = b.getAttribute("data-note"), v = b.textContent.trim();
          if (!id) return;
          if (v) STATE.notes[id] = v; else delete STATE.notes[id];
        });
        save();
      }, 400);
    });
    document.addEventListener("paste", function(e){
      var box = e.target.closest ? e.target.closest(".note-body") : null;
      if (!box) return;
      e.preventDefault();
      var txt = (e.clipboardData || window.clipboardData).getData("text");
      document.execCommand("insertText", false, txt);
    });
  }

  /* ---------------- widget: instant-feedback quiz ----------------
     <div class="ix" data-quiz="m3l1-q1">
       <p class="prompt">…</p>
       <div class="opts">
         <button class="opt" data-fb="why this is wrong">Option</button>
         <button class="opt" data-right data-fb="why this is right">Option</button>
       </div>
       <p class="fb"></p>
     </div>
  ------------------------------------------------------------- */
  function initQuizzes(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-quiz]"), function(box){
      var id = box.getAttribute("data-quiz");
      var opts = box.querySelectorAll(".opt");
      var fb = box.querySelector(".fb");
      var letters = "ABCDEFG";

      Array.prototype.forEach.call(opts, function(o, i){
        var label = o.innerHTML;
        o.innerHTML = '<span class="mark">' + letters[i] + '</span><span>' + label + '</span>';
        o.addEventListener("click", function(){
          if (box.getAttribute("data-locked") === "1") return;
          var right = o.hasAttribute("data-right");
          if (right) box.setAttribute("data-locked", "1");
          o.setAttribute("data-state", right ? "right" : "wrong");
          o.querySelector(".mark").textContent = right ? "✓" : "✗";
          if (right){
            Array.prototype.forEach.call(opts, function(x){
              x.disabled = true;
              if (x !== o && !x.getAttribute("data-state")) x.setAttribute("data-state","dim");
            });
            box.setAttribute("data-done","1");
            markDone(id);
          } else {
            o.disabled = true;
          }
          fb.setAttribute("data-tone", right ? "right" : "wrong");
          fb.setAttribute("data-show","1");
          fb.innerHTML = "<b>" + (right ? "Correct." : "Not this one.") + "</b> " + (o.getAttribute("data-fb") || "");
        });
      });

      if (isDone(id)){
        box.setAttribute("data-done","1");
        box.setAttribute("data-locked","1");
        Array.prototype.forEach.call(opts, function(x){
          x.disabled = true;
          if (x.hasAttribute("data-right")){
            x.setAttribute("data-state","right");
            x.querySelector(".mark").textContent = "✓";
            fb.setAttribute("data-tone","right");
            fb.setAttribute("data-show","1");
            fb.innerHTML = "<b>Correct.</b> " + (x.getAttribute("data-fb") || "");
          } else {
            x.setAttribute("data-state","dim");
          }
        });
      }
    });
  }

  /* ---------------- widget: put-in-order (drag + keyboard) ----------------
     <div class="ix" data-order="m3l4-steps">
       <ol class="order"><li data-pos="1">…</li>…</ol>
       <button class="btn check">Check order</button>
       <p class="fb"></p>
     </div>
  ------------------------------------------------------------- */
  function initOrders(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-order]"), function(box){
      var id   = box.getAttribute("data-order");
      var list = box.querySelector(".order");
      var btn  = box.querySelector(".check");
      var fb   = box.querySelector(".fb");
      var items = Array.prototype.slice.call(list.children);
      var n = items.length;

      items.forEach(function(li){
        var inner = li.innerHTML;
        li.innerHTML =
          '<span class="grip" aria-hidden="true">⣿</span>' +
          '<span class="txt">' + inner + '</span>' +
          '<span class="nudge"><button type="button" class="up" aria-label="Move up">▲</button>' +
          '<button type="button" class="down" aria-label="Move down">▼</button></span>';
        li.setAttribute("draggable","true");
      });

      /* shuffle so it is never already solved */
      for (var k = 0; k < 40; k++){
        list.appendChild(items[Math.floor(Math.random() * n)]);
      }
      if (correctOrder()) list.appendChild(list.firstElementChild);

      function correctOrder(){
        var kids = list.children, ok = true;
        for (var i = 0; i < kids.length; i++){
          if (+kids[i].getAttribute("data-pos") !== i + 1) ok = false;
        }
        return ok;
      }
      function clearMarks(){
        Array.prototype.forEach.call(list.children, function(li){ li.removeAttribute("data-state"); });
        fb.removeAttribute("data-show");
      }

      var dragged = null;
      list.addEventListener("dragstart", function(e){
        var li = e.target.closest("li"); if (!li) return;
        dragged = li; li.classList.add("drag");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain",""); } catch(err){}
      });
      list.addEventListener("dragend", function(){
        if (dragged) dragged.classList.remove("drag");
        Array.prototype.forEach.call(list.children, function(li){ li.classList.remove("over"); });
        dragged = null;
      });
      list.addEventListener("dragover", function(e){
        e.preventDefault();
        var li = e.target.closest("li");
        if (!li || li === dragged) return;
        Array.prototype.forEach.call(list.children, function(x){ x.classList.remove("over"); });
        li.classList.add("over");
      });
      list.addEventListener("drop", function(e){
        e.preventDefault();
        var li = e.target.closest("li");
        if (!li || !dragged || li === dragged) return;
        var kids = Array.prototype.slice.call(list.children);
        if (kids.indexOf(dragged) < kids.indexOf(li)) li.after(dragged); else li.before(dragged);
        li.classList.remove("over");
        clearMarks();
      });

      list.addEventListener("click", function(e){
        var li = e.target.closest("li"); if (!li) return;
        if (e.target.classList.contains("up") && li.previousElementSibling){
          li.previousElementSibling.before(li); clearMarks();
        }
        if (e.target.classList.contains("down") && li.nextElementSibling){
          li.nextElementSibling.after(li); clearMarks();
        }
      });

      btn.addEventListener("click", function(){
        var right = 0;
        Array.prototype.forEach.call(list.children, function(li, i){
          var ok = (+li.getAttribute("data-pos") === i + 1);
          li.setAttribute("data-state", ok ? "right" : "wrong");
          if (ok) right++;
        });
        fb.setAttribute("data-show","1");
        if (right === n){
          fb.setAttribute("data-tone","right");
          fb.innerHTML = "<b>That's the sequence.</b> " + (box.getAttribute("data-win") || "");
          box.setAttribute("data-done","1");
          markDone(id);
        } else {
          fb.setAttribute("data-tone","wrong");
          fb.innerHTML = "<b>" + right + " of " + n + " in place.</b> The green rows are correct — move the red ones and check again.";
        }
      });
    });
  }

  /* ---------------- widget: match pairs ----------------
     <div class="ix" data-match="m3l3-match">
       <div class="match">
         <div class="col" data-side="a"><h4>…</h4>
           <button class="cell" data-pair="1">…</button>…</div>
         <div class="col" data-side="b"><h4>…</h4>
           <button class="cell" data-pair="1" data-fb="…">…</button>…</div>
       </div>
       <p class="fb"></p>
     </div>
  ------------------------------------------------------------- */
  function initMatches(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-match]"), function(box){
      var id = box.getAttribute("data-match");
      var fb = box.querySelector(".fb");
      var colB = box.querySelector('[data-side="b"]');
      var cells = box.querySelectorAll(".cell");
      var total = box.querySelectorAll('[data-side="a"] .cell').length;
      var got = 0, sel = null;

      /* shuffle the right-hand column */
      var bs = Array.prototype.slice.call(colB.querySelectorAll(".cell"));
      for (var k = 0; k < 30; k++) colB.appendChild(bs[Math.floor(Math.random() * bs.length)]);

      Array.prototype.forEach.call(cells, function(c){
        c.addEventListener("click", function(){
          if (c.getAttribute("data-state") === "right") return;
          if (!sel){ sel = c; c.setAttribute("data-sel","1"); return; }
          if (sel === c){ sel.removeAttribute("data-sel"); sel = null; return; }

          var sameSide = sel.parentNode === c.parentNode;
          if (sameSide){
            sel.removeAttribute("data-sel"); sel = c; c.setAttribute("data-sel","1"); return;
          }

          sel.removeAttribute("data-sel");
          if (sel.getAttribute("data-pair") === c.getAttribute("data-pair")){
            sel.setAttribute("data-state","right");
            c.setAttribute("data-state","right");
            got++;
            fb.setAttribute("data-show","1");
            fb.setAttribute("data-tone","right");
            fb.innerHTML = "<b>Paired.</b> " + (c.getAttribute("data-fb") || sel.getAttribute("data-fb") || "");
            if (got === total){
              fb.innerHTML = "<b>All matched.</b> " + (box.getAttribute("data-win") || "");
              box.setAttribute("data-done","1");
              markDone(id);
            }
          } else {
            var wrong = [sel, c];
            wrong.forEach(function(x){ x.setAttribute("data-state","wrong"); });
            fb.setAttribute("data-show","1");
            fb.setAttribute("data-tone","wrong");
            fb.innerHTML = "<b>Not a pair.</b> Try that one against a different partner.";
            setTimeout(function(){
              wrong.forEach(function(x){
                if (x.getAttribute("data-state") === "wrong") x.removeAttribute("data-state");
              });
            }, 700);
          }
          sel = null;
        });
      });
    });
  }

  /* ---------------- widget: clickable hotspots ----------------
     <figure class="hotwrap" data-hotspot="m3l2-flow">
       <svg …>
         <g class="hs" data-title="…" data-body="…"> <rect class="hit" …/> <rect class="ring" …/> </g>
       </svg>
       <div class="hotpanel"><span class="hint">…</span></div>
     </figure>
  ------------------------------------------------------------- */
  function initHotspots(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-hotspot]"), function(wrap){
      var id = wrap.getAttribute("data-hotspot");
      var panel = wrap.querySelector(".hotpanel");
      var spots = wrap.querySelectorAll(".hs");
      var seen = {}, total = spots.length;

      Array.prototype.forEach.call(spots, function(g, i){
        g.setAttribute("tabindex","0");
        g.setAttribute("role","button");
        g.setAttribute("aria-label", g.getAttribute("data-title") || ("Hotspot " + (i+1)));
        function open(){
          Array.prototype.forEach.call(spots, function(x){ x.removeAttribute("data-open"); });
          g.setAttribute("data-open","1");
          panel.innerHTML = '<span class="ht">' + (g.getAttribute("data-title")||"") + '</span>' +
                            (g.getAttribute("data-body")||"");
          seen[i] = 1;
          if (Object.keys(seen).length === total){ wrap.setAttribute("data-done","1"); markDone(id); }
        }
        g.addEventListener("click", open);
        g.addEventListener("keydown", function(e){
          if (e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
        });
      });
    });
  }

  /* ---------------- widget: branching scenario ----------------
     <div class="branch" data-branch="m3-case">
       <div class="persona">…</div>
       <div class="scene" data-step="1">…
         <div class="choices">
           <button class="choice" data-go="2" data-tone="bad" data-outcome="…">…</button>
         </div>
       </div>
       <div class="scene" data-step="2" hidden>…</div>
     </div>
  ------------------------------------------------------------- */
  function initBranches(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-branch]"), function(box){
      var id = box.getAttribute("data-branch");
      var scenes = box.querySelectorAll(".scene");

      function goto(step){
        Array.prototype.forEach.call(scenes, function(s){
          s.hidden = (s.getAttribute("data-step") !== String(step));
        });
        var now = box.querySelector('.scene[data-step="' + step + '"]');
        if (now && now.getAttribute("data-end") === "1"){ markDone(id); box.setAttribute("data-done","1"); }
      }

      Array.prototype.forEach.call(box.querySelectorAll(".choice"), function(btn){
        btn.addEventListener("click", function(){
          var scene = btn.closest(".scene");
          if (scene.getAttribute("data-answered") === "1") return;
          scene.setAttribute("data-answered","1");

          Array.prototype.forEach.call(scene.querySelectorAll(".choice"), function(b){
            if (b !== btn) b.setAttribute("data-state","dim");
            b.disabled = true;
          });
          btn.setAttribute("data-picked","1");

          var out = document.createElement("div");
          out.className = "outcome";
          out.setAttribute("data-tone", btn.getAttribute("data-tone") || "");
          out.innerHTML = "<b>" + (btn.getAttribute("data-head") || "What happens next") + "</b>" +
                          (btn.getAttribute("data-outcome") || "");
          scene.appendChild(out);

          var go = btn.getAttribute("data-go");
          if (go){
            var next = document.createElement("button");
            next.className = "btn again";
            next.textContent = "Continue →";
            next.addEventListener("click", function(){ goto(go); });
            scene.appendChild(next);
          } else {
            markDone(id); box.setAttribute("data-done","1");
          }
        });
      });
    });
  }

  /* ---------------- progress rail + badges ---------------- */
  function lessonItems(sec){
    return sec.querySelectorAll("[data-quiz],[data-order],[data-match],[data-hotspot],[data-branch]");
  }
  function itemId(el){
    return el.getAttribute("data-quiz") || el.getAttribute("data-order") ||
           el.getAttribute("data-match") || el.getAttribute("data-hotspot") ||
           el.getAttribute("data-branch");
  }
  function lessonPct(sec){
    var items = lessonItems(sec), n = items.length;
    if (!n) return 0;
    var d = 0;
    Array.prototype.forEach.call(items, function(el){ if (isDone(itemId(el))) d++; });
    return Math.round(d / n * 100);
  }

  var rail, observer;
  function buildRail(){
    rail = document.getElementById("rail");
    if (!rail) return;
    var lessons = document.querySelectorAll("section.lesson");
    if (!lessons.length){ rail.style.display = "none"; return; }

    Array.prototype.forEach.call(lessons, function(sec, i){
      var colour = sec.style.getPropertyValue("--accent").trim() || "#131b26";
      var b = document.createElement("button");
      b.style.setProperty("--c", colour);
      b.setAttribute("data-target", sec.id);
      b.innerHTML = '<span class="seg"><i></i></span><span class="lab"></span>';
      b.querySelector(".lab").textContent = (i + 1) + ". " + (sec.getAttribute("data-short") || "");
      b.addEventListener("click", function(){ sec.scrollIntoView({block:"start"}); });
      rail.appendChild(b);
    });

    if ("IntersectionObserver" in window){
      observer = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          var btn = rail.querySelector('[data-target="' + en.target.id + '"]');
          if (btn) btn.setAttribute("data-here", en.isIntersecting ? "1" : "0");
        });
      }, {rootMargin:"-125px 0px -55% 0px"});
      Array.prototype.forEach.call(lessons, function(s){ observer.observe(s); });
    }
  }

  function refreshProgress(){
    if (rail){
      Array.prototype.forEach.call(document.querySelectorAll("section.lesson"), function(sec){
        var btn = rail.querySelector('[data-target="' + sec.id + '"]');
        if (btn) btn.querySelector(".seg i").style.width = lessonPct(sec) + "%";
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll(".badge"), function(b){
      var target = b.getAttribute("data-for");
      var sec = target ? document.getElementById(target) : null;
      var got = false;
      if (target === "*"){
        var all = document.querySelectorAll("section.lesson");
        got = all.length > 0;
        Array.prototype.forEach.call(all, function(s){ if (lessonPct(s) < 100) got = false; });
      } else if (sec){
        got = lessonPct(sec) === 100;
      }
      b.setAttribute("data-got", got ? "1" : "0");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".modcard"), function(card){
      var pct = modulePct(card.getAttribute("data-mod"));
      var bar = card.querySelector(".bar i"), lbl = card.querySelector(".pct");
      if (bar) bar.style.width = pct + "%";
      if (lbl) lbl.textContent = pct === 0 ? "Not started" : (pct === 100 ? "Complete" : pct + "% of activities done");
    });
  }

  /* index page can't see the module DOM, so it counts by id prefix */
  function modulePct(modId){
    if (!modId) return 0;
    var keys = Object.keys(STATE.done).filter(function(k){ return k.indexOf(modId) === 0; });
    var totals = (window.MODULE_ITEM_COUNTS || {});
    var total = totals[modId] || 0;
    if (!total) return keys.length ? 100 : 0;
    return Math.min(100, Math.round(keys.length / total * 100));
  }

  /* ---------------- export / import ---------------- */
  function initDialog(){
    var dlg = document.getElementById("dlg");
    if (!dlg) return;
    var txt = document.getElementById("dlgText"),
        title = document.getElementById("dlgTitle"),
        help = document.getElementById("dlgHelp"),
        loadBtn = document.getElementById("dlgLoad");

    document.getElementById("exportBtn").addEventListener("click", function(){
      title.textContent = "Export notes and progress";
      help.textContent = canStore
        ? "Copy this and keep it somewhere safe. Paste it back through Import to restore on any machine."
        : "Storage is blocked in this browser, so nothing is saving automatically. Copy this before you close the page.";
      txt.value = JSON.stringify(STATE, null, 2);
      loadBtn.hidden = true;
      dlg.showModal();
    });

    document.getElementById("importBtn").addEventListener("click", function(){
      title.textContent = "Import notes and progress";
      help.textContent = "Paste an exported block. Matching entries are replaced; anything not mentioned is left alone.";
      txt.value = "";
      loadBtn.hidden = false;
      dlg.showModal();
    });

    loadBtn.addEventListener("click", function(){
      var inc;
      try { inc = JSON.parse(txt.value); }
      catch(e){ toast("That is not valid exported text — check for a missing bracket."); return; }
      if (inc.notes) Object.keys(inc.notes).forEach(function(k){ STATE.notes[k] = inc.notes[k]; });
      if (inc.done)  Object.keys(inc.done ).forEach(function(k){ STATE.done[k]  = inc.done[k];  });
      save();
      Array.prototype.forEach.call(document.querySelectorAll(".note-body"), function(b){
        var id = b.getAttribute("data-note");
        if (id && STATE.notes[id]) b.textContent = STATE.notes[id];
      });
      refreshProgress();
      toast("Loaded. Reload the page to restore answered questions.");
    });

    document.getElementById("dlgCopy").addEventListener("click", function(){
      txt.select();
      try { document.execCommand("copy"); toast("Copied."); }
      catch(e){ toast("Select the text and copy it manually."); }
    });
    document.getElementById("dlgClose").addEventListener("click", function(){ dlg.close(); });

    var reset = document.getElementById("resetBtn");
    if (reset) reset.addEventListener("click", function(){
      if (!confirm("Clear all answers and typed notes on every module? This cannot be undone.")) return;
      STATE = {notes:{}, done:{}}; save(); location.reload();
    });
  }

  /* ---------------- go ---------------- */
  document.addEventListener("DOMContentLoaded", function(){
    buildNav();
    initNotes();
    initQuizzes();
    initOrders();
    initMatches();
    initHotspots();
    initBranches();
    buildRail();
    initDialog();
    if (HERE === "index" && typeof buildIndex === "function") buildIndex(MODULES);
    refreshProgress();
  });

  window.STUDY = { refresh: refreshProgress, state: function(){ return STATE; } };
})();
