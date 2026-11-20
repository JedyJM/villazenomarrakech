/* Guest portal behaviour.
   The WhatsApp number is read from /js/config.js (VILLA_ZENO.whatsappNumber).
   It is not copied here. The prefilled text is the guest message in the page,
   not the public booking message stored in that config file. */
(function () {
  "use strict";

  var cfg = window.VILLA_ZENO || {};
  var number = String(cfg.whatsappNumber || "").replace(/\D/g, "");
  var messageNode = document.getElementById("wa-message");
  var message = messageNode ? messageNode.textContent.replace(/\s+/g, " ").trim() : "";
  var href = number && message ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message) : "";

  document.querySelectorAll("[data-guest-whatsapp]").forEach(function (el) {
    if (!href) {
      el.setAttribute("aria-disabled", "true");
      if (el.hasAttribute("href")) el.removeAttribute("href");
      return;
    }
    el.href = href;
  });

  var fallback = document.querySelector("[data-wa-fallback]");
  if (fallback) fallback.hidden = Boolean(href);

  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setCurrent(key) {
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      if (link.getAttribute("data-nav") === "whatsapp") return;
      if (link.getAttribute("data-nav") === key) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  document.querySelectorAll("[data-nav]").forEach(function (link) {
    link.addEventListener("click", function () {
      var key = link.getAttribute("data-nav");
      if (!key || key === "whatsapp") return;
      setCurrent(key);
    });
  });

  var sections = ["accueil", "sejour", "services"].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var ratios = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });
      var best = "";
      var bestRatio = 0;
      sections.forEach(function (section) {
        var ratio = ratios[section.id] || 0;
        if (ratio > bestRatio) {
          best = section.id;
          bestRatio = ratio;
        }
      });
      if (best) setCurrent(best);
    }, { rootMargin: "-28% 0px -48% 0px", threshold: [0, 0.2, 0.45, 0.7, 1] });
    sections.forEach(function (section) { observer.observe(section); });
  }
})();
