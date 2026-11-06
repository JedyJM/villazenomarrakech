(function () {
  "use strict";

  var cfg = window.VILLA_ZENO || {};
  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2);
  var isEn = lang === "en";

  function waLink() {
    var num = (cfg.whatsappNumber || "").replace(/[^\d]/g, "");
    var msg = isEn ? cfg.whatsappMessageEn : cfg.whatsappMessageFr;
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg || "");
  }

  function bookingLink() {
    return isEn ? (cfg.bookingUrlEn || cfg.bookingUrlFr) : (cfg.bookingUrlFr || cfg.bookingUrlEn);
  }

  function applyCtas() {
    document.querySelectorAll("[data-cta]").forEach(function (el) {
      var type = el.getAttribute("data-cta");
      if (type === "airbnb") el.href = cfg.airbnbUrl || el.href;
      if (type === "booking") el.href = bookingLink() || el.href;
      if (type === "whatsapp") el.href = waLink();
    });
  }

  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightbox-image");
  var lbCap = document.getElementById("lightbox-caption");
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-full]"));
  var index = 0;

  function show(i) {
    if (!items.length || !lb) return;
    index = (i + items.length) % items.length;
    var el = items[index];
    lbImg.src = el.getAttribute("data-full");
    lbImg.alt = el.getAttribute("alt") || "";
    if (lbCap) lbCap.textContent = el.getAttribute("data-caption") || el.getAttribute("alt") || "";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = lb.querySelector(".lightbox-close");
    if (closeBtn) closeBtn.focus();
  }

  function hide() {
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
  }

  items.forEach(function (el, i) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      show(i);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show(i);
      }
    });
  });

  if (lb) {
    lb.querySelectorAll("[data-lb]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-lb");
        if (act === "close") hide();
        if (act === "prev") show(index - 1);
        if (act === "next") show(index + 1);
      });
    });
    lb.addEventListener("click", function (e) {
      if (e.target === lb) hide();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  applyCtas();
})();
