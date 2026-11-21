/* Guest portal behaviour.
   Wi-Fi values come from wifi-config.js. The WhatsApp number is read from
   /js/config.js. The prefilled text is the guest message, not the booking message. */
(function () {
  "use strict";

  var portal = window.GUEST_PORTAL || { wifi: {}, wifiPayload: function () { return ""; } };
  var lang = (document.documentElement.lang || "fr").slice(0, 2);
  var isEn = lang === "en";
  var cfg = window.VILLA_ZENO || {};
  var number = String(cfg.whatsappNumber || "").replace(/\D/g, "");
  var message = isEn
    ? "Hello, I am a guest at Villa Zen'O and I would like to get in touch."
    : "Bonjour, je suis un invité de la Villa Zen'O et j'aimerais vous contacter.";
  var href = number && message ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message) : "";

  document.querySelectorAll("[data-guest-whatsapp]").forEach(function (el) {
    if (!href) {
      el.setAttribute("aria-disabled", "true");
      if (el.hasAttribute("href")) el.removeAttribute("href");
      return;
    }
    el.href = href;
  });

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
    else if (file.indexOf("demandes") === 0) key = "demandes";
    else if (file.indexOf("acces") === 0) key = "acces";
    if (key) setCurrent(key);
  })();

  var nav = document.querySelector(".bottom-nav");
  if (nav) {
    var keyboardTimer = 0;
    function isTypingField(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag !== "INPUT") return false;
      var type = (el.type || "text").toLowerCase();
      return ["hidden", "checkbox", "radio", "button", "submit", "reset", "file", "range", "image"].indexOf(type) === -1;
    }
    function keyboardClosed() {
      var view = window.visualViewport;
      if (!view) return true;
      return window.innerHeight - view.height < 80;
    }
    function paintNav() {
      var hide = isTypingField(document.activeElement);
      nav.classList.toggle("is-keyboard", hide);
      nav.setAttribute("aria-hidden", hide ? "true" : "false");
    }
    document.addEventListener("focusin", function (event) {
      if (!isTypingField(event.target)) return;
      window.clearTimeout(keyboardTimer);
      paintNav();
    });
    document.addEventListener("focusout", function (event) {
      if (!isTypingField(event.target)) return;
      window.clearTimeout(keyboardTimer);
      keyboardTimer = window.setTimeout(function () {
        if (!isTypingField(document.activeElement)) paintNav();
      }, 150);
    });
    if (window.visualViewport) {
      var onViewport = function () {
        if (isTypingField(document.activeElement)) return;
        if (keyboardClosed()) paintNav();
      };
      window.visualViewport.addEventListener("resize", onViewport);
      window.visualViewport.addEventListener("scroll", onViewport);
    }
  }
})();
