/* =============================================================================
   Villa Zen'O — bandeau cookies + Meta Pixel (chargé UNIQUEMENT après accord)
   - Rien n'est chargé tant que le visiteur n'a pas cliqué « Accepter ».
   - « Refuser » est aussi visible que « Accepter » (exigence CNIL / RGPD).
   - Le choix est gardé 6 mois puis redemandé.
   - Un lien [data-cookie-settings] (pied de page) rouvre le bandeau.
   - L'identifiant du pixel se règle dans js/config.js (metaPixelId).
     Laissé vide : aucun bandeau, aucun pixel.
   ============================================================================= */
(function () {
  "use strict";
  var cfg = window.VILLA_ZENO || {};
  var PIXEL_ID = String(cfg.metaPixelId || "").trim();
  var KEY = "vz_consent_v1";
  var MAX_AGE = 1000 * 60 * 60 * 24 * 182; // ~6 mois
  var en = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;
  var legalHref = document.querySelector(".footer-legal a") ? document.querySelector(".footer-legal a").getAttribute("href") : (en ? "legal-notice.html" : "mentions-legales.html");

  var T = en ? {
    text: "With your consent, we use Meta cookies to measure site visits and our ads.",
    more: "Learn more",
    accept: "Accept",
    refuse: "Decline"
  } : {
    text: "Avec votre accord, nous utilisons des cookies Meta pour mesurer la fréquentation du site et nos publicités.",
    more: "En savoir plus",
    accept: "Accepter",
    refuse: "Refuser"
  };

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!v || typeof v.ads !== "boolean" || !v.t || Date.now() - v.t > MAX_AGE) return null;
      return v;
    } catch (e) { return null; }
  }
  function save(ads) {
    try { localStorage.setItem(KEY, JSON.stringify({ ads: ads, t: Date.now() })); } catch (e) {}
  }

  /* ---------- Meta Pixel ---------- */
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded || !PIXEL_ID) return;
    pixelLoaded = true;
    /* Code de base officiel Meta */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("consent", "grant");
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
  }
  function track(evt, params) {
    if (pixelLoaded && window.fbq) window.fbq("track", evt, params || {});
  }

  /* Événements utiles pour une location : clics vers WhatsApp / e-mail (Contact)
     et vers Airbnb / Booking (Lead). Ne se déclenchent que si le pixel est chargé. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/wa\.me|whatsapp\.com|^mailto:/i.test(h)) track("Contact", { content_name: /mailto:/i.test(h) ? "email" : "whatsapp" });
    else if (/airbnb\./i.test(h)) track("Lead", { content_name: "airbnb" });
    else if (/booking\.com/i.test(h)) track("Lead", { content_name: "booking" });
  }, true);

  /* ---------- Bandeau ---------- */
  var css = "" +
    ".vz-cookie{position:fixed;left:16px;bottom:16px;z-index:9999;width:min(340px,calc(100% - 32px));" +
    "background:rgba(255,250,243,.97);color:var(--ink,#1c1916);border:1px solid var(--line,rgba(28,25,22,.12));" +
    "border-radius:10px;box-shadow:0 12px 32px rgba(28,25,22,.08);padding:14px 16px;" +
    "font-family:var(--sans,system-ui,sans-serif);font-weight:300;font-size:.78rem;line-height:1.5;" +
    "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:vzc-in .35s ease}" +
    "@keyframes vzc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    ".vz-cookie[hidden]{display:none}" +
    ".vz-cookie p{margin:0 0 10px;color:var(--muted,#5e554c);text-align:left;hyphens:none}" +
    ".vz-cookie p a{color:var(--ink,#1c1916);text-underline-offset:2px}" +
    ".vz-cookie-actions{display:flex;gap:8px;justify-content:flex-end}" +
    ".vz-cookie-actions button{min-height:34px;padding:0 14px;border-radius:999px;cursor:pointer;" +
    "font-family:inherit;font-weight:400;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;" +
    "border:1px solid rgba(28,25,22,.35);background:transparent;color:var(--ink,#1c1916);transition:background .2s,color .2s,border-color .2s}" +
    ".vz-cookie-actions button:hover{border-color:var(--ink,#1c1916)}" +
    ".vz-cookie-actions .vz-accept{background:var(--ink,#1c1916);border-color:var(--ink,#1c1916);color:var(--paper,#fffaf3)}" +
    ".vz-cookie-actions .vz-accept:hover{background:var(--terracotta-dark,#6b3022);border-color:var(--terracotta-dark,#6b3022)}" +
    ".vz-cookie-actions button:focus-visible{outline:2px solid var(--gold,#c4a46a);outline-offset:2px}" +
    "@media (max-width:600px){.vz-cookie{left:12px;right:12px;bottom:76px;width:auto;padding:12px 14px}}";

  var box = null;
  function openBanner() {
    if (box) { box.hidden = false; return; }
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    box = document.createElement("div");
    box.className = "vz-cookie";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.setAttribute("aria-label", "Cookies");
    box.innerHTML =
      '<p>' + T.text + ' <a href="' + legalHref + '#cookies">' + T.more + '</a></p>' +
      '<div class="vz-cookie-actions">' +
      '<button type="button" class="vz-refuse">' + T.refuse + '</button>' +
      '<button type="button" class="vz-accept">' + T.accept + '</button></div>';
    document.body.appendChild(box);
    box.querySelector(".vz-accept").addEventListener("click", function () { save(true); box.hidden = true; loadPixel(); });
    box.querySelector(".vz-refuse").addEventListener("click", function () {
      var wasOn = pixelLoaded;
      save(false); box.hidden = true;
      if (wasOn) location.reload(); // décharge le pixel déjà actif
    });
  }

  function init() {
    if (!PIXEL_ID) return; // pas d'identifiant : on ne montre rien
    document.querySelectorAll("[data-cookie-settings]").forEach(function (el) {
      el.hidden = false;
      el.addEventListener("click", function (e) { e.preventDefault(); openBanner(); });
    });
    var c = read();
    if (c && c.ads) loadPixel();
    else if (!c) openBanner();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.VZConsent = { open: openBanner, track: track };
})();
