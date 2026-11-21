/* Admin shell: test-mode gate, bottom nav, keyboard hide. French. */
(function () {
  "use strict";

  var TEST_MODE = true;
  var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";
  var GOOGLE_CLIENT_ID = "";
  var SESSION_KEY = "vz.admin";

  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function session() {
    try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; }
  }
  function setSession(value) {
    try { sessionStorage.setItem(SESSION_KEY, value); } catch (e) {}
  }

  var ICONS = {
    aujourdhui: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    demandes: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 3.5h6v4H9z"/><path d="M9 12h6M9 16h4"/>',
    sejours: '<path d="M4 11.2 12 4l8 7.2"/><path d="M7 10.5V20h10v-9.5"/>',
    stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
    reglages: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1"/><circle cx="10" cy="17" r="2.1"/>'
  };
  var TABS = [
    ["aujourdhui", "aujourdhui.html", "Aujourd’hui"],
    ["demandes", "demandes.html", "Demandes"],
    ["sejours", "sejours.html", "Séjours"],
    ["stats", "stats.html", "Stats"],
    ["reglages", "reglages.html", "Réglages"]
  ];

  function gateHtml() {
    return '<div class="gate" data-gate>'
      + '<p class="logo">Villa Zen’O<small>Administration</small></p>'
      + '<h1>Espace de Mehdi</h1>'
      + '<p class="lead">Connexion réservée à Mehdi et Jedy.</p>'
      + '<button type="button" class="primary" data-google>Continuer avec Google</button>'
      + (TEST_MODE ? '<button type="button" class="ghost" data-test>Mode test</button>' : '')
      + '<p class="note" data-gate-note></p>'
      + '</div>';
  }

  function bindGate(root) {
    var note = root.querySelector("[data-gate-note]");
    var google = root.querySelector("[data-google]");
    var test = root.querySelector("[data-test]");
    if (google) google.addEventListener("click", function () {
      if (!GOOGLE_CLIENT_ID) {
        if (note) note.textContent = "La connexion Google se vérifie dans le script, pour Mehdi et Jedy. En aperçu, utilisez le mode test.";
        return;
      }
      if (note) note.textContent = "Ouverture de Google…";
    });
    if (test) test.addEventListener("click", function () {
      setSession("test");
      window.location.href = "aujourdhui.html";
    });
  }

  function confirmerCount() {
    try {
      var stored = sessionStorage.getItem("vz.admin.confirmer");
      if (stored != null && stored !== "") return Number(stored) || 0;
    } catch (e) {}
    return TEST_MODE ? 4 : 0;
  }

  function paintNav() {
    var tab = document.body.getAttribute("data-tab") || "";
    var html = '<nav class="bottom-nav" aria-label="Administration">' + TABS.map(function (item) {
      var current = item[0] === tab ? ' aria-current="location"' : "";
      var dot = item[0] === "demandes" && confirmerCount() > 0 ? " has-dot" : "";
      return '<a href="' + item[1] + '"' + current + ' class="' + dot + '" data-nav="' + item[0] + '">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="stroke">' + ICONS[item[0]] + '</g></svg>'
        + item[2] + '</a>';
    }).join("") + "</nav>";
    document.body.insertAdjacentHTML("beforeend", html);
    var nav = document.querySelector(".bottom-nav");
    var timer = 0;
    function typing(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag !== "INPUT") return false;
      var type = (el.type || "text").toLowerCase();
      return ["hidden", "checkbox", "radio", "button", "submit", "reset", "file", "range", "image"].indexOf(type) === -1;
    }
    function paint() {
      var hide = typing(document.activeElement);
      nav.classList.toggle("is-keyboard", hide);
      nav.setAttribute("aria-hidden", hide ? "true" : "false");
    }
    document.addEventListener("focusin", function (event) {
      if (!typing(event.target)) return;
      window.clearTimeout(timer);
      paint();
    });
    document.addEventListener("focusout", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!typing(document.activeElement)) paint();
      }, 150);
    });
  }

  if (TEST_MODE && query("test") === "1") setSession("test");

  var page = document.body.getAttribute("data-page") || "";
  if (page === "gate") {
    if (session()) window.location.replace("aujourdhui.html");
    else bindGate(document);
  } else if (!session()) {
    document.body.classList.add("is-locked");
    document.body.insertAdjacentHTML("beforeend", gateHtml());
    bindGate(document);
  } else {
    paintNav();
  }

  window.AdminShell = {
    TEST_MODE: TEST_MODE,
    SCRIPT_URL: SCRIPT_URL,
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    session: session
  };
})();
