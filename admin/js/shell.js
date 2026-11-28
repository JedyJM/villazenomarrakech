/* Admin shell: Google sign-in gate (+ test mode), bottom nav, keyboard hide. French. */
(function () {
  "use strict";

  var TEST_MODE = true;
  // One URL and one client for the whole site: js/vz-api.js. Only a
  // "client present" flag here: the /exec URL itself is never read
  // synchronously (on a preview it is only known after /api/vz-env).
  var SCRIPT_URL = window.VZApi ? "VZApi" : "";
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

  // Mode test only on local and Vercel preview hosts, never on
  // villazenomarrakech.com / www (GitHub Pages): no button, ?test=1 ignored,
  // a stored test session is dropped. The script still never serves real
  // data to token=test.
  function testHost(host) {
    host = String(host || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || /\.vercel\.app$/.test(host);
  }
  var TEST_ALLOWED = TEST_MODE && testHost(window.location.hostname);

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
      + (TEST_ALLOWED ? '<button type="button" class="ghost" data-test>Mode test</button>' : '')
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
    if (!window.VZApi) { if (note) note.textContent = MSG_NETWORK; return; }
    window.VZApi.post({ action: "admin-auth", id_token: idToken }).then(function (result) {
      if (result.ok) {
        setSession(idToken);
        try { sessionStorage.setItem(EMAIL_KEY, String(result.data.email || "")); } catch (e) {}
        afterSignIn();
        return;
      }
      clearSession();
      if (!note) return;
      if (result.kind === "unavailable") note.textContent = window.VZApi.message(result);
      else if (result.kind === "network" || result.kind === "timeout" || result.kind === "busy") note.textContent = MSG_NETWORK;
      else note.textContent = result.error === "invalid_token" ? MSG_INVALID : MSG_DENIED;
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
    if (test && !TEST_ALLOWED) test.remove();
    else if (test) test.hidden = false;
    if (test && TEST_ALLOWED) test.addEventListener("click", function () {
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

  function staffConfirmDemo() {
    try {
      var host = window.location.hostname;
      var preview = host === "localhost" || host === "127.0.0.1" || /\.vercel\.app$/.test(host);
      return preview && query("demo") === "confirm-staff";
    } catch (e) { return false; }
  }

  if (TEST_ALLOWED && query("test") === "1") setSession("test");
  if (!TEST_ALLOWED && session() === "test") clearSession();
  if (session() && session() !== "test" && tokenExpired(session())) clearSession();

  var page = document.body.getAttribute("data-page") || "";
  if (page === "gate") {
    if (session()) window.location.replace("aujourdhui.html");
    else bindGate(document);
  } else if (staffConfirmDemo()) {
    paintNav();
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

  /* Data cache (Aujourd'hui, Demandes, Encaissement, Séjours, Stats).
     Raw API answers are kept in localStorage per session kind (test /
     Google account). Every page OPEN shows the cached answer at once, then
     asks the script again in the background (stale-while-revalidate): a
     request sent today is never hidden until tomorrow (root cause of
     2026-11-27: the old cache was refreshed once per day). « Actualiser »
     forces the same network read. One call per feed at a time: a second
     ask while one is running joins it (no stacked requests). Filters
     (origine test, Jeu de test) apply at render time, never in the cache.
     Signing out clears it. */
  var CACHE_PREFIX = "vz.admin.cache.v3.";
  var inflight = {};
  // Feeds read by this page load (network): warm() never re-reads them.
  var readThisLoad = {};
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
  function clearCache() {
    invalidate("");
    // Older cache generations (v2 = once a day).
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf("vz.admin.cache.") === 0) localStorage.removeItem(key);
      }
    } catch (e) {}
  }
  function running(params) { return !!inflight[params]; }
  // name: cache key. params: query string after the token ("action=stays").
  // done(data, meta) runs at once with the cached answer (meta.cached) and
  // again when the network answer arrives; data is null when nothing is
  // known. opts.force: no cached paint first (« Actualiser »: the page
  // already shows data). opts.maxAge (ms): skip the network when the cache
  // is younger (background warm-up only). Pages never pass maxAge: each
  // open refreshes.
  function cachedGet(name, params, done, opts) {
    opts = opts || {};
    var entry = readCache(name);
    // A cached answer the page can no longer use (e.g. saved before a field
    // existed) is dropped and refetched at once.
    var valid = opts.valid || (name.indexOf("stays") === 0 ? hasTotals : null);
    if (entry && valid && !valid(entry.data)) entry = null;
    if (entry && !opts.force) done(entry.data, { cached: true, at: entry.at, stale: true });
    if (entry && opts.maxAge && Date.now() - entry.at < opts.maxAge) return;
    if (!window.VZApi || !session()) { if (!entry) done(null, { at: 0, error: true, result: { ok: false, kind: "session" } }); return; }
    var job = inflight[params];
    if (!job) {
      var query = {};
      new URLSearchParams(params).forEach(function (value, key) { query[key] = value; });
      readThisLoad[name] = true;
      job = inflight[params] = apiGet(query);
      job.then(function () { delete inflight[params]; });
    }
    job.then(function (result) {
      if (result.ok) {
        var saved = writeCache(name, result.data);
        done(result.data, { at: saved.at });
      } else {
        // Never silent: the page shows the error (with the cached copy if any).
        done(entry ? entry.data : null, { at: entry ? entry.at : 0, cached: !!entry, error: true, result: result });
      }
    });
  }
  // Zen'O rows must carry totalVoyageur (Stats brut).
  function hasTotals(data) {
    var list = (data && data.stays) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].portal !== false && !("totalVoyageur" in list[i])) return false;
    return true;
  }
  // Cached answer younger than maxAge ms (default 10 min).
  function isFresh(name, maxAge) {
    var entry = readCache(name);
    var age = maxAge == null ? WARM_MAX_AGE : maxAge;
    return !!(entry && Date.now() - entry.at < age && !(name.indexOf("stays") === 0 && !hasTotals(entry.data)));
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
  // Fills, in the background, the shared feeds this page did not read and
  // that have no answer younger than 10 minutes, so the next tab opens at
  // once (that tab still refreshes when it opens). Never twice per load.
  var WARM_MAX_AGE = 10 * 60 * 1000;
  var warming = false;
  function warm(delay) {
    if (warming || !session() || !SCRIPT_URL || !window.fetch) return;
    warming = true;
    window.setTimeout(function () {
      feeds().forEach(function (feed) {
        if (readThisLoad[feed[0]] || running(feed[1]) || isFresh(feed[0])) return;
        cachedGet(feed[0], feed[1], function () {}, { maxAge: WARM_MAX_AGE });
      });
    }, delay == null ? 300 : delay);
  }

  /* « Actualiser » line: stamp + button. el = container (.sync). state:
     { at, busy }. The button is disabled while a read runs (no double
     send). */
  function syncHtml(at, busy) {
    return '<span data-stamp>' + (busy ? "Mise à jour…" : stampText(at)) + '</span>'
      + '<button type="button" data-refresh' + (busy ? ' disabled aria-busy="true"' : "") + '>Actualiser</button>';
  }
  function paintSync(el, at, busy) {
    if (!el) return;
    el.innerHTML = syncHtml(at, busy);
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

  /* Shared admin calls (js/vz-api.js): token and test flag added here,
     answers always awaited, failures returned as { ok:false, kind }.
     Admin reads go through the real Sheet (Google check + whole tabs):
     they may take longer than a guest read. 45 s, and a timed-out read is
     never re-sent (each copy kept running on the script and queued the
     next one: « Chargement… » for over a minute, 2026-11-25). */
  var ADMIN_GET = { timeout: 45000, retries: 1, retryTimeout: false };
  function apiGet(params, opts) {
    var query = Object.assign({}, params, { token: session() });
    if (TEST_ALLOWED) query.test = "1";
    return window.VZApi ? window.VZApi.get(query, Object.assign({}, ADMIN_GET, opts || {})) : Promise.resolve({ ok: false, kind: "network" });
  }
  function apiPost(body, opts) {
    var payload = Object.assign({ token: session(), test: TEST_ALLOWED ? "1" : "" }, body);
    return window.VZApi ? window.VZApi.post(payload, opts) : Promise.resolve({ ok: false, kind: "network" });
  }
  // Error line + « Réessayer » + « Se reconnecter » on session expiry.
  function showError(node, result, retry, context) {
    if (!window.VZApi || !node) return;
    window.VZApi.showError(node, result, retry, { context: context, signIn: "index.html", onSignIn: function () { clearSession(); } });
  }

  /* Page-level load error (any read that failed): one line above the page
     content with « Réessayer ». loadError(null) hides it. */
  function loadError(result, retry) {
    var node = document.querySelector("[data-load-error]");
    if (!result) { if (node) node.hidden = true; return; }
    if (!node) {
      node = document.createElement("p");
      node.className = "load-error wrap";
      node.setAttribute("data-load-error", "");
      node.setAttribute("role", "alert");
      var main = document.querySelector("main");
      if (main && main.parentNode) main.parentNode.insertBefore(node, main);
      else document.body.insertBefore(node, document.body.firstChild);
    }
    showError(node, result, retry);
  }

  // « restauration » → « Restauration »; only the first letter changes.
  function serviceLabel(value) {
    var text = String(value || "").trim();
    return text ? text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1) : text;
  }
  /* French labels for the raw script values (2026-11-27 review: « Menage ·
     maison », « Transfert · departure », « Massage · decouverte »). */
  var SERVICE_FR = {
    restauration: "Restauration", menage: "Ménage", piscine: "Piscine", activites: "Activités",
    transfert: "Transfert", course: "Transfert en ville", location_voiture: "Location", massage: "Massage"
  };
  var EXTRA_FR = {
    departure: "départ", "départ": "départ", depart: "départ", arrival: "arrivée", "arrivée": "arrivée", arrivee: "arrivée",
    maison: "toute la maison", chambres: "chambres uniquement", nettoyage: "entretien",
    breakfast: "petit-déjeuner", lunch: "déjeuner", dinner: "dîner",
    quad: "quad", dromadaire: "dromadaire", cheval: "balade à cheval",
    citadine: "citadine", "4x4": "4×4", "en ville": ""
  };
  var SOIN_FR = {
    decouverte: "Massage découverte", relaxant: "Massage relaxant ou tonique", amincissant: "Massage amincissant",
    signature: "Massage Signature", manucure: "Manucure", pedicure: "Pédicure", vernis: "Pose vernis ou French",
    jambes: "Épilation jambes", dos: "Épilation dos", bras: "Épilation bras", duvet: "Épilation duvet, sourcils ou menton",
    aisselles: "Épilation aisselles", maillot: "Épilation maillot"
  };
  // { label, extra } in French. Massage: the treatments are the label.
  function frenchLabel(raw) {
    var service = String(raw.service || "").toLowerCase();
    var sous = String(raw.trip || raw.sous_type || "").trim();
    var label = SERVICE_FR[service] || serviceLabel(raw.service) || "Demande";
    if (service === "massage" && sous) {
      var names = sous.split("+").map(function (id) { return SOIN_FR[id.trim().toLowerCase()] || id.trim(); });
      return { label: names.join(" + "), extra: "" };
    }
    var key = sous.toLowerCase();
    var extra = EXTRA_FR.hasOwnProperty(key) ? EXTRA_FR[key] : sous;
    return { label: label, extra: extra };
  }

  /* Admin demande from action=demandes (shared field model). when: local
     date + time; hasTime false when the script sent no time (never a
     made-up 00:00). */
  function demandeFromApi(raw) {
    var fields = window.VZFields;
    var day = fields ? fields.iso(raw.date) : String(raw.date || "").slice(0, 10);
    var clock = fields ? fields.clock(raw.time) : "";
    var d = (day || "1970-01-01").split("-");
    var t = clock ? clock.split(":") : ["0", "0"];
    var when = new Date(Number(d[0]), (Number(d[1]) || 1) - 1, Number(d[2]) || 1, Number(t[0]), Number(t[1]));
    var fr = frenchLabel(raw);
    var service = fr.label;
    var key = (String(raw.service || "") + " " + (serviceLabel(raw.service) || "")).toLowerCase();
    var kind = "menage";
    if (key.indexOf("petit") >= 0 || raw.meal === "breakfast") kind = "breakfast";
    else if (key.indexOf("ner") >= 0 || key.indexOf("dinner") >= 0 || raw.meal === "dinner") kind = "dinner";
    else if (key.indexOf("nage") >= 0) kind = "menage";
    else if (key.indexOf("quad") >= 0 || key.indexOf("activ") >= 0) kind = "quad";
    else if (key.indexOf("transfert") >= 0 || key.indexOf("voiture") >= 0 || key.indexOf("course") >= 0) kind = "car";
    else if (key.indexOf("massage") >= 0) kind = "flower";
    var created = Date.parse(raw.created);
    var guest = String(raw.guest || "");
    return {
      id: String(raw.id || ""),
      kind: kind,
      label: service,
      service: String(raw.service || ""),
      adults: Number(raw.adults) || 0,
      children: Number(raw.children) || 0,
      kids_4_11: Number(raw.kids_4_11) || 0,
      kids_under_4: Number(raw.kids_under_4) || 0,
      extras: String(raw.extras || ""),
      extra: fr.extra,
      sous_type: String(raw.sous_type || ""),
      guest: fields && fields.isPlaceholderName(guest) ? "" : guest,
      stay: guest,
      stay_id: String(raw.stay || ""),
      staff: raw.staff || "",
      status: raw.status || "Envoyée",
      when: when,
      hasTime: !!clock,
      hasDate: !!day,
      created: isFinite(created) ? created : Date.now(),
      total: raw.total,
      token: raw.token || "",
      offert: !!raw.offert,
      date_confirmation: fields ? fields.confirmedAt(raw.date_confirmation) : "",
      staff_confirm: Array.isArray(raw.staff_confirm) ? raw.staff_confirm : []
    };
  }

  window.AdminShell = {
    api: { get: apiGet, post: apiPost },
    showError: showError,
    loadError: loadError,
    demandeFromApi: demandeFromApi,
    frenchLabel: frenchLabel,
    serviceLabel: serviceLabel,
    cachedGet: cachedGet,
    warm: warm,
    isFresh: isFresh,
    running: running,
    paintSync: paintSync,
    invalidate: invalidate,
    stampText: stampText,
    localDay: localDay,
    TEST_MODE: TEST_MODE,
    TEST_ALLOWED: TEST_ALLOWED,
    staffConfirmDemo: staffConfirmDemo,
    testData: testData,
    setTestData: setTestData,
    isTestRow: isTestRow,
    realOnly: realOnly,
    SCRIPT_URL: SCRIPT_URL,
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    session: session,
    clearSession: clearSession,
    email: function () { try { return sessionStorage.getItem(EMAIL_KEY) || ""; } catch (e) { return ""; } },
    signOut: signOut
  };
})();
