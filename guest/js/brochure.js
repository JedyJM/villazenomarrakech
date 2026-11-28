/* Spa brochure viewer (Massages & soins). Full screen, 4 pages.
   - Images load only when the viewer opens (data-src), never with the page.
   - Swipe (scroll-snap), arrows, keyboard ← →.
   - « Fermer », Escape and the back gesture / button close it. Opening
     pushes one history entry (#brochure) so « back » closes the viewer
     instead of leaving the page. Nothing else on the page changes: the
     selected soins, counters, date and note stay as they were. */
(function () {
  "use strict";
  var dialog = document.querySelector("[data-brochure]");
  var opener = document.querySelector("[data-brochure-open]");
  if (!dialog || !opener) return;
  var pages = dialog.querySelector("[data-brochure-pages]");
  var dots = dialog.querySelectorAll(".brochure-dots i");
  var live = dialog.querySelector("[data-brochure-live]");
  var prev = dialog.querySelector('[data-brochure-go="-1"]');
  var next = dialog.querySelector('[data-brochure-go="1"]');
  var count = pages.children.length;
  var current = 0;
  var pushed = false;

  // A reload on …#brochure does not reopen it: drop the stale hash.
  if (location.hash === "#brochure" && history.replaceState) {
    history.replaceState(history.state, "", location.pathname + location.search);
  }

  function loadImages() {
    dialog.querySelectorAll("img[data-src]").forEach(function (img) {
      img.src = img.getAttribute("data-src");
      img.removeAttribute("data-src");
    });
  }
  function paint(index) {
    current = Math.max(0, Math.min(count - 1, index));
    dots.forEach(function (dot, i) { dot.classList.toggle("is-on", i === current); });
    if (live) live.textContent = "Page " + (current + 1) + " sur " + count;
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === count - 1;
  }
  function go(index) {
    var target = Math.max(0, Math.min(count - 1, index));
    var page = pages.children[target];
    if (page) pages.scrollTo({ left: page.offsetLeft - pages.offsetLeft - (pages.clientWidth - page.clientWidth) / 2, behavior: "smooth" });
    paint(target);
  }
  function isOpen() { return dialog.hasAttribute("open"); }
  function shut() {
    if (!isOpen()) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    document.documentElement.classList.remove("is-brochure");
    opener.focus({ preventScroll: true });
  }
  function open() {
    if (isOpen()) return;
    loadImages();
    document.documentElement.classList.add("is-brochure");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    pages.scrollLeft = 0;
    paint(0);
    if (history.pushState) {
      history.pushState({ vzBrochure: true }, "", location.pathname + location.search + "#brochure");
      pushed = true;
    }
    var close = dialog.querySelector("[data-brochure-close]");
    if (close) close.focus({ preventScroll: true });
  }
  // Every close goes through history when we pushed an entry, so the back
  // gesture and « Fermer » leave the same state.
  function requestClose() {
    if (pushed) { history.back(); return; }
    shut();
  }

  opener.addEventListener("click", open);
  dialog.querySelector("[data-brochure-close]").addEventListener("click", requestClose);
  dialog.addEventListener("cancel", function (event) { event.preventDefault(); requestClose(); });
  window.addEventListener("popstate", function () {
    if (!isOpen()) return;
    pushed = false;
    shut();
  });
  if (prev) prev.addEventListener("click", function () { go(current - 1); });
  if (next) next.addEventListener("click", function () { go(current + 1); });
  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") { event.preventDefault(); go(current - 1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); go(current + 1); }
  });
  var raf = 0;
  pages.addEventListener("scroll", function () {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var width = pages.children[0] ? pages.children[0].getBoundingClientRect().width : pages.clientWidth;
      var gap = parseFloat(getComputedStyle(pages).columnGap) || 0;
      paint(Math.round(pages.scrollLeft / (width + gap)));
    });
  }, { passive: true });
})();
