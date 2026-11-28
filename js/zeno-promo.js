/* =============================================================================
   Villa Zen'O — pop-up promo ZENO2027 (cachée)
   - Visible SEULEMENT si l'URL contient ?zeno=1, sur la home FR (/) et EN (/en/).
   - Sans ce paramètre : ce script ne touche à rien (aucun markup, aucun style).
   - Après ouverture, ?zeno=1 est retiré de la barre d'adresse (history.replaceState) :
     un rechargement ou un partage affiche la page normale.
   - Le CSS est injecté par ce script, uniquement quand la pop-up s'ouvre.
   ============================================================================= */
(function () {
  "use strict";
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  if (params.get("zeno") !== "1") return;

  var path = location.pathname;
  var isEn = /^\/en\/?(index\.html)?$/.test(path);
  var isFr = /^\/(index\.html)?$/.test(path);
  if (!isEn && !isFr) return;

  var cfg = window.VILLA_ZENO || {};
  var number = String(cfg.whatsappNumber || "212661147610").replace(/\D/g, "");
  var CODE = "ZENO2027";

  var T = isEn ? {
    title: "You found Zen'O… almost.",
    lead: "Breakfast is on us, for your whole group.",
    dates: "Book by 31 December 2026 for a stay between 1 January and 28 February 2027.",
    how: "Direct, Airbnb or Booking.com: just send your code to us on WhatsApp.",
    codeLabel: "Your code:",
    copy: "Copy code",
    copied: "Copied",
    cta: "Book on WhatsApp",
    small: "Bookings made by 31/12/2026, stays from 01/01 to 28/02/2027.",
    close: "Close",
    message: "Hello Villa Zen'O, I have the code ZENO2027. My dates: … Number of people: …"
  } : {
    title: "Zen'O se cache encore…",
    lead: "Le petit-déjeuner est offert à tout le groupe.",
    dates: "Réservez jusqu'au 31 décembre 2026 pour un séjour entre le 1er janvier et le 28 février 2027.",
    how: "En direct, sur Airbnb ou sur Booking.com : envoyez-nous votre code sur WhatsApp.",
    codeLabel: "Votre code :",
    copy: "Copier le code",
    copied: "Copié",
    cta: "Réserver sur WhatsApp",
    small: "Réservations jusqu'au 31/12/2026, séjours du 01/01 au 28/02/2027.",
    close: "Fermer",
    message: "Bonjour Villa Zen'O, j'ai le code ZENO2027. Mes dates : … Nombre de personnes : …"
  };

  var css = "" +
    ".zeno-promo{width:min(96vw,460px);max-width:460px;max-height:calc(100dvh - 32px);margin:auto;padding:0;" +
    "border:1px solid rgba(196,164,106,.45);border-radius:12px;background:var(--paper,#fffaf3);color:var(--ink,#1c1916);" +
    "box-shadow:0 28px 80px rgba(28,25,22,.4);overflow:hidden}" +
    ".zeno-promo::backdrop{background:rgba(25,21,18,.68);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".zeno-promo-inner{position:relative;max-height:calc(100dvh - 34px);overflow-y:auto;overscroll-behavior:contain;" +
    "padding:3.25rem clamp(1rem,4.3vw,2.2rem) 1.35rem;text-align:center;font-family:var(--sans,system-ui,sans-serif)}" +
    ".zeno-promo-inner::before{content:\"\";display:block;position:absolute;top:22px;left:50%;width:36px;height:1px;margin:0;transform:translateX(-50%);background:var(--gold,#c4a46a)}" +
    ".zeno-promo-close{position:absolute;top:6px;right:6px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;" +
    "padding:0;border:0;border-radius:50%;background:transparent;color:var(--ink,#1c1916);" +
    "font-size:1.45rem;font-weight:300;line-height:1;cursor:pointer}" +
    ".zeno-promo-close:hover{color:var(--terracotta,#8c3f2a)}" +
    ".zeno-promo-close:focus-visible,.zeno-promo-copy:focus-visible,.zeno-promo-cta:focus-visible{outline:2px solid var(--gold,#c4a46a);outline-offset:3px}" +
    ".zeno-promo h2{margin:0 0 .7rem;font-family:var(--serif,serif);font-weight:500;font-size:clamp(1.55rem,6.4vw,2rem);" +
    "line-height:1.18;color:var(--ink,#1c1916);white-space:nowrap}" +
    ".zeno-promo h2:focus{outline:none}" +
    ".zeno-promo p.zeno-promo-lead{text-align:center;hyphens:none}.zeno-promo-nowrap{white-space:nowrap}" +
    ".zeno-promo-lead{margin:0 0 1rem;font-family:var(--serif,serif);font-style:italic;font-size:1.08rem;line-height:1.45;color:var(--terracotta,#8c3f2a);white-space:nowrap}" +
    ".zeno-promo p.zeno-promo-text{margin:0 0 .5rem;font-size:.9rem;line-height:1.55;color:var(--muted,#5e554c);text-align:center;hyphens:none;text-wrap:pretty}" +
    ".zeno-promo-code{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45rem;margin:1.15rem 0 1.1rem;" +
    "padding:.85rem .6rem .75rem;border:0;border-top:1px solid var(--gold,#c4a46a);border-bottom:1px solid var(--gold,#c4a46a);background:transparent}" +
    ".zeno-promo-code-text{font-size:.8125rem;letter-spacing:.04em;color:var(--muted,#5e554c);white-space:nowrap;font-weight:400}" +
    ".zeno-promo-code-text strong{display:block;margin:.2rem 0 0;font-family:var(--serif,serif);font-weight:500;font-size:1.42rem;" +
    "letter-spacing:.16em;color:var(--ink,#1c1916)}" +
    ".zeno-promo-copy{min-height:44px;min-width:10.5rem;padding:0 1.15rem;border:1px solid rgba(196,164,106,.9);border-radius:3px;background:transparent;" +
    "color:var(--ink,#1c1916);font-family:inherit;font-size:.8125rem;font-weight:400;letter-spacing:.03em;text-transform:none;cursor:pointer}" +
    ".zeno-promo-copy:hover{border-color:var(--ink,#1c1916)}" +
    ".zeno-promo-cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;box-sizing:border-box;margin:0 0 .8rem;padding:.7rem 1.2rem;" +
    "border-radius:3px;background:var(--terracotta,#8c3f2a);color:#fff !important;font-family:inherit;font-size:.9375rem;font-weight:400;" +
    "letter-spacing:.03em;text-transform:none;text-decoration:none}" +
    ".zeno-promo-cta:hover{background:var(--terracotta-dark,#6b3022)}" +
    ".zeno-promo p.zeno-promo-small{margin:0;font-size:.75rem;line-height:1.5;color:var(--muted,#5e554c);text-align:center;text-wrap:pretty}" +
    "@media (max-height:700px){.zeno-promo-inner{padding-bottom:1.05rem}" +
    ".zeno-promo h2{margin-bottom:.55rem}.zeno-promo-lead{margin-bottom:.8rem}.zeno-promo-code{margin:.85rem 0 .85rem;padding:.7rem .5rem .6rem}}";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Same characters, last phrase kept on one line (avoids a widow like « 28/02/2027. »).
  function para(cls, text, tail) {
    var p = el("p", cls);
    if (tail && text.length > tail.length && text.slice(-tail.length) === tail) {
      p.appendChild(document.createTextNode(text.slice(0, text.length - tail.length)));
      p.appendChild(el("span", "zeno-promo-nowrap", tail));
    } else {
      p.textContent = text;
    }
    return p;
  }

  function stripParam() {
    try {
      var kept = location.search.slice(1).split("&").filter(function (part) {
        if (!part) return false;
        var key = part.split("=")[0];
        try { key = decodeURIComponent(key.replace(/\+/g, " ")); } catch (e) {}
        return key !== "zeno";
      });
      history.replaceState(history.state, "", location.pathname + (kept.length ? "?" + kept.join("&") : "") + location.hash);
    } catch (e) {}
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }
  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
      dialog.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      ok ? resolve() : reject();
    });
  }

  var dialog = el("dialog", "zeno-promo");
  if (typeof dialog.showModal !== "function") return; // très vieux navigateur : pas de pop-up
  dialog.id = "zeno-promo";
  dialog.setAttribute("aria-labelledby", "zeno-promo-title");

  var inner = el("div", "zeno-promo-inner");
  var close = el("button", "zeno-promo-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", T.close);

  var title = el("h2", null, T.title);
  title.id = "zeno-promo-title";
  // Focus lands on the title (read first by screen readers), not on the close button.
  title.tabIndex = -1;
  title.setAttribute("autofocus", "");

  // Lead line: the last two words never split (same text, one nowrap span).
  var lead = el("p", "zeno-promo-lead");
  var cut = T.lead.lastIndexOf(" ", T.lead.lastIndexOf(" ") - 1);
  lead.appendChild(document.createTextNode(T.lead.slice(0, cut + 1)));
  lead.appendChild(el("span", "zeno-promo-nowrap", T.lead.slice(cut + 1)));

  var codeBox = el("div", "zeno-promo-code");
  var codeText = el("span", "zeno-promo-code-text", T.codeLabel + " ");
  codeText.appendChild(el("strong", null, CODE));
  var copy = el("button", "zeno-promo-copy", T.copy);
  copy.type = "button";
  copy.setAttribute("aria-live", "polite");
  codeBox.appendChild(codeText);
  codeBox.appendChild(copy);

  var cta = el("a", "zeno-promo-cta", T.cta);
  cta.href = "https://wa.me/" + number + "?text=" + encodeURIComponent(T.message);
  cta.target = "_blank";
  cta.rel = "noopener";

  inner.appendChild(close);
  inner.appendChild(title);
  inner.appendChild(lead);
  inner.appendChild(para("zeno-promo-text", T.dates, isEn ? "28 February 2027." : "et le 28 février 2027."));
  inner.appendChild(el("p", "zeno-promo-text", T.how));
  inner.appendChild(codeBox);
  inner.appendChild(cta);
  inner.appendChild(para("zeno-promo-small", T.small, isEn ? "stays from 01/01 to 28/02/2027." : "séjours du 01/01 au 28/02/2027."));
  dialog.appendChild(inner);

  var copyTimer = null;
  copy.addEventListener("click", function () {
    copyText(CODE).then(function () {
      copy.textContent = T.copied;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { copy.textContent = T.copy; }, 2000);
    }, function () {});
  });
  close.addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", function () {
    clearTimeout(copyTimer);
    dialog.remove();
    style.remove();
  });

  var style = el("style", null, css);
  style.id = "zeno-promo-style";
  document.head.appendChild(style);
  document.body.appendChild(dialog);
  dialog.showModal();
  stripParam();
})();
