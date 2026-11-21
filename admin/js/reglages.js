/* Réglages. French. Test mode keeps the switches in this browser. */
(function () {
  "use strict";

  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return ""; } };
  var STORE = "vz.admin.reglages";
  var DEFAULTS = {
    notif_email_on: true,
    notif_email_to: "mehdimoumni@hotmail.com",
    recap_8h_on: true
  };
  var model = {
    notif_email_on: true,
    notif_email_to: DEFAULTS.notif_email_to,
    recap_8h_on: true
  };

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(STORE) || ""); } catch (e) { return null; }
  }
  function writeLocal() {
    try { localStorage.setItem(STORE, JSON.stringify(model)); } catch (e) {}
  }
  function fitEmail(input) {
    if (!input) return;
    var probe = fitEmail.probe;
    if (!probe) {
      probe = fitEmail.probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-9999px;top:0;white-space:pre;font-weight:500;font-size:16px;font-family:Inter,system-ui,sans-serif;";
      document.body.appendChild(probe);
    }
    probe.textContent = input.value || " ";
    var copy = input.closest(".reg-copy");
    var max = copy ? copy.clientWidth : 240;
    var width = Math.ceil(probe.getBoundingClientRect().width) + 1;
    if (max > 40) width = Math.min(width, max);
    input.style.width = width + "px";
  }
  function paint() {
    document.querySelectorAll("[data-key]").forEach(function (button) {
      var on = !!model[button.getAttribute("data-key")];
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var email = document.querySelector("[data-email]");
    if (email && document.activeElement !== email) email.value = model.notif_email_to;
    fitEmail(email);
  }
  function save() {
    writeLocal();
    if (!shell.SCRIPT_URL || !window.fetch) return;
    window.fetch(shell.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "save-reglages",
        test: shell.TEST_MODE ? "1" : "",
        token: shell.session(),
        reglages: model
      })
    }).catch(function () {});
  }
  function boot() {
    var root = document.querySelector("[data-reglages]");
    if (!root || document.body.classList.contains("is-locked")) return;
    var stored = readLocal();
    if (stored) {
      model.notif_email_on = stored.notif_email_on !== false;
      model.recap_8h_on = stored.recap_8h_on !== false;
      if (stored.notif_email_to) model.notif_email_to = stored.notif_email_to;
    }
    paint();
    if (!shell.TEST_MODE && shell.SCRIPT_URL && window.fetch) {
      window.fetch(shell.SCRIPT_URL + "?action=get-reglages&token=" + encodeURIComponent(shell.session()))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.reglages) return;
          model.notif_email_on = data.reglages.notif_email_on !== false;
          model.recap_8h_on = data.reglages.recap_8h_on !== false;
          if (data.reglages.notif_email_to) model.notif_email_to = data.reglages.notif_email_to;
          paint();
        }).catch(function () {});
    }
    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-key]");
      if (!button || button.disabled) return;
      var key = button.getAttribute("data-key");
      model[key] = !model[key];
      paint();
      save();
    });
    var email = root.querySelector("[data-email]");
    if (email) {
      email.addEventListener("input", function () { fitEmail(email); });
      email.addEventListener("change", function () {
        var value = String(email.value || "").trim();
        if (!value || value.indexOf("@") < 1) {
          email.value = model.notif_email_to;
          fitEmail(email);
          return;
        }
        model.notif_email_to = value;
        fitEmail(email);
        save();
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitEmail(email); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
