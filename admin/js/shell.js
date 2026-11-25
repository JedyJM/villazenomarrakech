/* Admin shell: Google sign-in gate (+ test mode), bottom nav, keyboard hide. French. */
(function () {
  "use strict";

  var TEST_MODE = true;
  var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";
  // Public OAuth web client ID (safe in the front-end). The script checks aud.
  var GOOGLE_CLIENT_ID = "971461193352-3kafun281dtmvorv1tpp2j7n9l2g8klf.apps.googleusercontent.com";
  var GIS_SRC = "https://accounts.google.com/gsi/client";
  var SESSION_KEY = "vz.admin";
  // « Jeu de test » switch (Réglages). Off by default: rows with
  // origine "test" never reach Stats or Séjours unless it is turned on.
  var TEST_DATA_KEY = "vz.admin.jeu_test";
  var EMAIL_KEY = "vz.admin.email";
  var MSG_DENIED = "Ce compte Google n’est pas autorisé à ouvrir l’administration.";
  var MSG_INVALID = "La connexion Google n’a pas pu être vérifiée. Réessayez.";
  var MSG_NETWORK = "Connexion au serveur impossible. Vérifiez le réseau et réessayez.";

  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function session() {
    try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; }
  }
  function setSession(value) {
    try { sessionStorage.setItem(SESSION_KEY, value); } catch (e) {}
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(EMAIL_KEY);
    } catch (e) {}
  }
  // A Google ID token lasts about an hour: drop it once expired.
  function tokenExpired(token) {
    var parts = String(token || "").split(".");
    if (parts.length !== 3) return false;
    try {
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var payload = JSON.parse(window.atob(b64));
      return !payload.exp || payload.exp * 1000 <= new Date().getTime();
    } catch (e) {
      return true;
    }
  }
  function signOut() {
    clearCache();
    clearSession();
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect();
    } catch (e) {}
    window.location.href = "index.html";
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
      + '<div class="google-slot" data-google-slot></div>'
      + '<button type="button" class="primary" data-google>Continuer avec Google</button>'
      + (TEST_MODE ? '<button type="button" class="ghost" data-test>Mode test</button>' : '')
      + '<p class="note" data-gate-note role="status" aria-live="polite"></p>'
      + '</div>';
  }

  function loadGis(done) {
    if (window.google && window.google.accounts && window.google.accounts.id) { done(true); return; }
    var existing = document.querySelector('script[data-gis]');
    var script = existing || document.createElement("script");
    script.addEventListener("load", function () { done(!!(window.google && window.google.accounts && window.google.accounts.id)); });
    script.addEventListener("error", function () { done(false); });
    if (existing) return;
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-gis", "");
    document.head.appendChild(script);
  }

  function afterSignIn() {
    if ((document.body.getAttribute("data-page") || "") === "gate") window.location.replace("aujourdhui.html");
    else window.location.reload();
  }

  function verifyToken(idToken, note) {
    if (note) note.textContent = "Vérification du compte…";
    if (!window.fetch) { if (note) note.textContent = MSG_NETWORK; return; }
    window.fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "admin-auth", id_token: idToken })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data && data.ok) {
        setSession(idToken);
        try { sessionStorage.setItem(EMAIL_KEY, String(data.email || "")); } catch (e) {}
        afterSignIn();
        return;
      }
      clearSession();
      var error = data && data.error;
      if (note) note.textContent = (error === "invalid_token") ? MSG_INVALID : MSG_DENIED;
    }).catch(function () {
      if (note) note.textContent = MSG_NETWORK;
    });
  }

  function bindGate(root) {
    var note = root.querySelector("[data-gate-note]");
    var google = root.querySelector("[data-google]");
    var slot = root.querySelector("[data-google-slot]");
    var test = root.querySelector("[data-test]");
    var ready = false;
    if (!slot && google) {
      slot = document.createElement("div");
      slot.className = "google-slot";
      slot.setAttribute("data-google-slot", "");
      google.parentNode.insertBefore(slot, google);
    }
    if (google) google.addEventListener("click", function () {
      if (!GOOGLE_CLIENT_ID) {
        if (note) note.textContent = "La connexion Google n’est pas encore configurée. En aperçu, utilisez le mode test.";
        return;
      }
      if (ready) {
        window.google.accounts.id.prompt();
        return;
      }
      if (note) note.textContent = "Chargement de Google…";
      start();
    });
    if (test) test.addEventListener("click", function () {
      setSession("test");
      window.location.href = "aujourdhui.html";
    });
    function start() {
      if (!GOOGLE_CLIENT_ID) return;
      loadGis(function (ok) {
        if (!ok) {
          if (note) note.textContent = "Google n’a pas pu être chargé. Vérifiez le réseau et réessayez.";
          return;
        }
        if (!ready) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: function (response) {
              if (response && response.credential) verifyToken(response.credential, note);
              else if (note) note.textContent = MSG_INVALID;
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            ux_mode: "popup"
          });
          ready = true;
        }
        if (slot && !slot.hasChildNodes()) {
          var width = Math.min(320, Math.max(200, (slot.parentNode && slot.parentNode.clientWidth ? slot.parentNode.clientWidth - 48 : 320)));
          window.google.accounts.id.renderButton(slot, {
            type: "standard", theme: "outline", size: "large", shape: "pill",
            text: "continue_with", logo_alignment: "left", locale: "fr", width: width
          });
          if (google) google.hidden = true;
          if (note && note.textContent === "Chargement de Google…") note.textContent = "";
        }
      });
    }
    start();
  }

  function bindSignOut() {
    var buttons = document.querySelectorAll("[data-signout]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        event.preventDefault();
        signOut();
      });
    }
  }

  function confirmerCount() {
    try {
      var stored = sessionStorage.getItem("vz.admin.confirmer");
      if (stored != null && stored !== "") return Number(stored) || 0;
    } catch (e) {}
    return 0;
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
  if (!TEST_MODE && session() === "test") clearSession();
  if (session() && session() !== "test" && tokenExpired(session())) clearSession();

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
    bindSignOut();
  }

  function testData() {
    try { return localStorage.getItem(TEST_DATA_KEY) === "1"; } catch (e) { return false; }
  }
  function setTestData(on) {
    try { if (on) localStorage.setItem(TEST_DATA_KEY, "1"); else localStorage.removeItem(TEST_DATA_KEY); } catch (e) {}
  }
  function isTestRow(row) {
    return String((row && row.origine) || "").trim().toLowerCase() === "test";
  }
  function realOnly(list) {
    var all = list || [];
    return testData() ? all.slice() : all.filter(function (row) { return !isTestRow(row); });
  }

  /* Daily data cache (Séjours, Stats, Aujourd'hui). Raw API answers are
     kept in localStorage per session kind (test / Google account) and
     per local day: one network update per day, or on « Actualiser ».
     An answer from an earlier day is shown at once, then refreshed in
     the background. Filters (origine test, Jeu de test) apply at render
     time, never in the cache. Signing out clears it. */
  var CACHE_PREFIX = "vz.admin.cache.v2.";
  var inflight = {};
  function localDay(d) {
    d = d || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function cacheScope() {
    var s = session();
    if (!s) return "";
    if (s === "test") return "test";
    var mail = "";
    try { mail = sessionStorage.getItem(EMAIL_KEY) || ""; } catch (e) {}
    return "google:" + mail + (TEST_MODE ? ":t" : "");
  }
  function readCache(name) {
    try {
      var entry = JSON.parse(localStorage.getItem(CACHE_PREFIX + name) || "null");
      return entry && entry.scope === cacheScope() ? entry : null;
    } catch (e) { return null; }
  }
  function writeCache(name, data) {
    var entry = { scope: cacheScope(), day: localDay(), at: Date.now(), data: data };
    try { localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(entry)); } catch (e) {}
    return entry;
  }
  function invalidate(prefix) {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf(CACHE_PREFIX + (prefix || "")) === 0) localStorage.removeItem(key);
      }
    } catch (e) {}
  }
  function clearCache() { invalidate(""); }
  // name: cache key. params: query string after the token ("action=stays").
  // done(data, meta) runs once with the cached answer (meta.cached) and
  // again if a network answer follows; data is null when nothing is known.
  // opts.force: skip today's cache (« Actualiser »).
  function cachedGet(name, params, done, opts) {
    opts = opts || {};
    var entry = opts.force ? null : readCache(name);
    // A cached answer the page can no longer use (e.g. saved before a field
    // existed) is dropped and refetched at once.
    var valid = opts.valid || (name.indexOf("stays") === 0 ? hasTotals : null);
    if (entry && valid && !valid(entry.data)) entry = null;
    var fresh = entry && entry.day === localDay();
    if (entry) done(entry.data, { cached: true, at: entry.at, stale: !fresh });
    if (fresh) return;
    if (!SCRIPT_URL || !window.fetch || !session()) { if (!entry) done(null, { at: 0, error: true }); return; }
    var url = SCRIPT_URL + "?" + params + "&token=" + encodeURIComponent(session()) + (TEST_MODE ? "&test=1" : "");
    var job = inflight[url];
    if (!job) {
      job = inflight[url] = window.fetch(url).then(function (res) { return res.json(); });
      job.then(function () { delete inflight[url]; }, function () { delete inflight[url]; });
    }
    job.then(function (data) {
      if (data && data.ok) {
        var saved = writeCache(name, data);
        done(data, { at: saved.at });
      } else if (!entry) done(data || null, { at: 0, error: true });
    }).catch(function () {
      if (!entry) done(null, { at: 0, error: true });
    });
  }
  // Zen'O rows must carry totalVoyageur (Stats brut).
  function hasTotals(data) {
    var list = (data && data.stays) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].portal !== false && !("totalVoyageur" in list[i])) return false;
    return true;
  }
  function isFresh(name) {
    var entry = readCache(name);
    return !!(entry && entry.day === localDay() && !(name.indexOf("stays") === 0 && !hasTotals(entry.data)));
  }
  // The feeds Aujourd'hui, Séjours and Stats share (one cache key each).
  function feeds() {
    var year = new Date().getFullYear();
    return [
      ["stays", "action=stays"],
      ["stays-stats", "action=stays-stats"],
      ["demandes", "action=demandes"],
      ["depenses-" + year, "action=depenses&year=" + year]
    ];
  }
  // Fills, in the background and side by side, the shared feeds that have
  // no answer from today yet, so the next tab opens at once. At most one
  // call per feed and per day; nothing when everything is fresh.
  var warming = false;
  function warm(delay) {
    if (warming || !session() || !SCRIPT_URL || !window.fetch) return;
    warming = true;
    window.setTimeout(function () {
      feeds().forEach(function (feed) {
        if (!isFresh(feed[0])) cachedGet(feed[0], feed[1], function () {});
      });
    }, delay == null ? 300 : delay);
  }

  // "Mis à jour aujourd’hui à 08:12" / "hier à 21:40" / "le 22 nov. à 09:05".
  function stampText(at) {
    if (!at) return "Données non chargées";
    var d = new Date(at);
    var hm = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
    var day = localDay(d);
    var y = new Date();
    y.setDate(y.getDate() - 1);
    if (day === localDay()) return "Mis à jour aujourd’hui à " + hm;
    if (day === localDay(y)) return "Mis à jour hier à " + hm;
    var months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    return "Mis à jour le " + d.getDate() + "\u00A0" + months[d.getMonth()] + " à " + hm;
  }

  window.AdminShell = {
    cachedGet: cachedGet,
    warm: warm,
    isFresh: isFresh,
    invalidate: invalidate,
    stampText: stampText,
    localDay: localDay,
    TEST_MODE: TEST_MODE,
    testData: testData,
    setTestData: setTestData,
    isTestRow: isTestRow,
    realOnly: realOnly,
    SCRIPT_URL: SCRIPT_URL,
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    session: session,
    email: function () { try { return sessionStorage.getItem(EMAIL_KEY) || ""; } catch (e) { return ""; } },
    signOut: signOut
  };
})();
