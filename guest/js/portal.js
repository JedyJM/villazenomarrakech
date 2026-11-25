/* Guest portal behaviour.
   Wi-Fi values come from wifi-config.js. The prefilled text is the guest message.
   Guests write to Mehdi. PAYPAL_EMAIL is the PayPal account.
   While TEST_MODE is true in guest/js/requests.js, the recap does not open a real PayPal payment. */
var MEHDI_WHATSAPP = "212661147610";
/* Reserved for future automated staff messages (WhatsApp Cloud API, not built yet). No guest button opens this number. */
var VILLA_WHATSAPP = "212661552597";
var PAYPAL_EMAIL = "Mr.moums@gmail.com";
var TEST_VILLA_WHATSAPP = "212661147610";

function paypalPayUrl(amount, bookingId) {
  var email = String(PAYPAL_EMAIL || "");
  var total = Number(amount);
  if (!email || !isFinite(total)) return "";
  var item = "Villa Zen\u2019O \u2013 S\u00e9jour " + String(bookingId || "");
  return "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick"
    + "&business=" + encodeURIComponent(email)
    + "&currency_code=EUR"
    + "&amount=" + total.toFixed(2)
    + "&item_name=" + encodeURIComponent(item)
    + "&no_shipping=1";
}
window.paypalPayUrl = paypalPayUrl;

function paintVillaWhatsApp(testMode) {
  var real = String(MEHDI_WHATSAPP || "").replace(/\D/g, "");
  var number = testMode !== false ? String(TEST_VILLA_WHATSAPP || "").replace(/\D/g, "") : real;
  var isEn = (document.documentElement.lang || "fr").slice(0, 2) === "en";
  var message = isEn
    ? "Hello, I am a guest at Villa Zen'O and I would like to get in touch."
    : "Bonjour, je suis un invité de la Villa Zen'O et j'aimerais vous contacter.";
  var href = number && message ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message) : "";
  document.querySelectorAll("[data-villa-whatsapp]").forEach(function (el) {
    if (!number) return;
    el.href = "https://wa.me/" + number;
  });
  // Contacts utiles: Mehdi's number written out (+212 661 147 610), from MEHDI_WHATSAPP.
  var shown = real.length === 12 && real.indexOf("212") === 0
    ? "+212 " + real.slice(3, 6) + " " + real.slice(6, 9) + " " + real.slice(9)
    : (real ? "+" + real : "");
  if (shown) {
    document.querySelectorAll("[data-mehdi-number]").forEach(function (el) { el.textContent = shown; });
    document.querySelectorAll("[data-mehdi-label]").forEach(function (el) { el.setAttribute("aria-label", "Mehdi, WhatsApp, " + shown); });
  }
  document.querySelectorAll("[data-guest-whatsapp]").forEach(function (el) {
    if (!href) {
      el.setAttribute("aria-disabled", "true");
      if (el.hasAttribute("href")) el.removeAttribute("href");
      return;
    }
    el.removeAttribute("aria-disabled");
    el.href = href;
  });
}
window.paintVillaWhatsApp = paintVillaWhatsApp;

(function () {
  "use strict";

  var portal = window.GUEST_PORTAL || { wifi: {}, wifiPayload: function () { return ""; } };
  var lang = (document.documentElement.lang || "fr").slice(0, 2);
  var isEn = lang === "en";
  paintVillaWhatsApp(true);

  document.querySelectorAll("[data-wifi-network]").forEach(function (node) {
    node.textContent = portal.wifi.network || "";
  });
  document.querySelectorAll("[data-wifi-password]").forEach(function (node) {
    node.textContent = portal.wifi.password || "";
  });

  var copyButton = document.querySelector("[data-wifi-copy]");
  var statusNode = document.querySelector("[data-wifi-status]");
  if (copyButton && portal.wifi.password) {
    var labelCopy = copyButton.getAttribute("data-label-copy") || "Copy";
    var labelCopied = copyButton.getAttribute("data-label-copied") || "Copied";
    var actionNode = copyButton.querySelector("[data-wifi-action]");
    var resetTimer = 0;

    function setCopied(ok) {
      if (actionNode) actionNode.textContent = ok ? labelCopied : labelCopy;
      copyButton.classList.toggle("is-copied", ok);
      if (statusNode) {
        statusNode.textContent = ok
          ? (isEn ? "Password copied." : "Mot de passe copié.")
          : (isEn ? "The password could not be copied." : "Le mot de passe n’a pas pu être copié.");
      }
      window.clearTimeout(resetTimer);
      if (ok) {
        resetTimer = window.setTimeout(function () {
          if (actionNode) actionNode.textContent = labelCopy;
          copyButton.classList.remove("is-copied");
        }, 1800);
      }
    }

    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise(function (resolve, reject) {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        try {
          var ok = document.execCommand("copy");
          document.body.removeChild(area);
          ok ? resolve() : reject(new Error("copy"));
        } catch (err) {
          document.body.removeChild(area);
          reject(err);
        }
      });
    }

    copyButton.addEventListener("click", function () {
      copyText(portal.wifi.password).then(function () { setCopied(true); }).catch(function () { setCopied(false); });
    });
  }

  function drawWifiQr(canvas) {
    if (!canvas || typeof qrcode !== "function") return;
    var payload = portal.wifiPayload();
    if (!payload) return;
    var qr = qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    var count = qr.getModuleCount();
    var quiet = 4;
    var modulePx = 8;
    var size = (count + quiet * 2) * modulePx;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#1c1916";
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) ctx.fillRect((col + quiet) * modulePx, (row + quiet) * modulePx, modulePx, modulePx);
      }
    }
  }

  var dialog = document.getElementById("wifi-qr-dialog");
  var scanButton = document.querySelector("[data-wifi-scan]");
  if (dialog && scanButton) {
    var canvas = dialog.querySelector("[data-wifi-qr]");
    scanButton.addEventListener("click", function () {
      drawWifiQr(canvas);
      if (typeof dialog.showModal === "function") dialog.showModal();
    });
    dialog.querySelectorAll("[data-wifi-qr-close]").forEach(function (button) {
      button.addEventListener("click", function () { dialog.close(); });
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  var contactsDialog = document.getElementById("contacts-dialog");
  var contactButtons = document.querySelectorAll("[data-open-contacts]");
  if (contactsDialog) {
    contactButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof contactsDialog.showModal === "function") {
          contactsDialog.showModal();
          var title = contactsDialog.querySelector("h2");
          if (title) title.focus();
        }
        contactButtons.forEach(function (item) { item.setAttribute("aria-expanded", "true"); });
      });
    });
    contactsDialog.querySelectorAll("[data-contacts-close]").forEach(function (button) {
      button.addEventListener("click", function () { contactsDialog.close(); });
    });
    contactsDialog.addEventListener("click", function (event) {
      if (event.target === contactsDialog) contactsDialog.close();
    });
    contactsDialog.addEventListener("close", function () {
      contactButtons.forEach(function (item) { item.setAttribute("aria-expanded", "false"); });
    });
  }

  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 4);
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

  (function markPage() {
    var file = (location.pathname.split("/").pop() || "").toLowerCase();
    var key = "";
    if (!file || file === "index.html") key = "accueil";
    else if (file.indexOf("demandes") === 0 || file.indexOf("recap") === 0) key = "demandes";
    else if (file.indexOf("acces") === 0) key = "acces";
    if (key) setCurrent(key);
  })();

  /* iPhone keyboard: while a text field is focused the bottom nav stays hidden
     (html.is-keyboard), even when visualViewport scrolls or resizes. It comes
     back only after blur. The focused field is scrolled above the keyboard. */
  var nav = document.querySelector(".bottom-nav");
  var root = document.documentElement;
  var keyboardTimer = 0;
  var revealTimer = 0;
  function isTypingField(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag !== "INPUT") return false;
    var type = (el.type || "text").toLowerCase();
    return ["hidden", "checkbox", "radio", "button", "submit", "reset", "file", "range", "image", "color"].indexOf(type) === -1;
  }
  // Room under the page for the keyboard, so a low field can scroll above it.
  function keyboardSpace() {
    var view = window.visualViewport;
    var space = view ? Math.max(0, Math.round(window.innerHeight - view.height)) : 0;
    root.style.setProperty("--kb-space", space + "px");
    root.classList.toggle("is-kb-open", space >= 80);
  }
  function setKeyboard(on) {
    root.classList.toggle("is-keyboard", on);
    if (on) keyboardSpace();
    else {
      root.style.removeProperty("--kb-space");
      root.classList.remove("is-kb-open");
    }
    if (!nav) return;
    nav.classList.toggle("is-keyboard", on);
    nav.setAttribute("aria-hidden", on ? "true" : "false");
    if (on) nav.style.transform = "";
  }
  // Keeps the focused field between the sticky header and the top of the keyboard.
  function revealField(el) {
    if (!el || !el.getBoundingClientRect || document.activeElement !== el) return;
    var view = window.visualViewport;
    var top = view ? view.offsetTop : 0;
    var height = view ? view.height : window.innerHeight;
    var head = document.querySelector(".site-header");
    var headBottom = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
    var box = el.closest(".field, .when-card, .meal-allergies, label") || el;
    var rect = box.getBoundingClientRect();
    var margin = 16;
    var minTop = Math.max(top, headBottom) + margin;
    var maxBottom = top + height - margin;
    var delta = 0;
    if (rect.bottom > maxBottom) delta = rect.bottom - maxBottom;
    if (rect.top - delta < minTop) delta = rect.top - minTop;
    if (Math.abs(delta) > 1) window.scrollBy(0, delta);
  }
  document.addEventListener("focusin", function (event) {
    if (!isTypingField(event.target)) return;
    window.clearTimeout(keyboardTimer);
    setKeyboard(true);
    var field = event.target;
    window.clearTimeout(revealTimer);
    // The keyboard animates in; check again once it has settled.
    revealTimer = window.setTimeout(function () {
      revealField(field);
      revealTimer = window.setTimeout(function () { revealField(field); }, 250);
    }, 300);
  });
  document.addEventListener("focusout", function (event) {
    if (!isTypingField(event.target)) return;
    window.clearTimeout(keyboardTimer);
    keyboardTimer = window.setTimeout(function () {
      if (!isTypingField(document.activeElement)) setKeyboard(false);
    }, 150);
  });
  if (window.visualViewport) {
    var lastHeight = window.visualViewport.height;
    window.visualViewport.addEventListener("resize", function () {
      var active = document.activeElement;
      var shrank = window.visualViewport.height < lastHeight - 40;
      lastHeight = window.visualViewport.height;
      if (!isTypingField(active)) return;
      setKeyboard(true);
      if (shrank) revealField(active);
    });
    window.visualViewport.addEventListener("scroll", function () {
      if (isTypingField(document.activeElement)) setKeyboard(true);
    });
  }
})();
