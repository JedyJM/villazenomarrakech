/* Guest portal: the ONE stay context, shared by every guest page.
   Needs js/vz-api.js and js/vz-fields.js first.

   - The link ?stay=<id>&k=<key> is resolved once per page. The URL wins
     and is stored together with its key; without a URL, the stored pair
     is used (internal links carry neither).
   - One in-flight action=list per page (home welcome, gate, Mes demandes,
     récap and the WhatsApp texts all read the same answer).
   - Stale-while-revalidate: the last good answer for the same id AND key
     paints at once (marked stale), the server answer replaces it. The
     cache is dropped on invalid_link / expired, never on a network error.
   - snapshot(): { id, k, state, stay, items, error, stale }
     state: none | loading | ok | invalid | expired | error */
(function () {
  "use strict";

  var STAY_STORE = "villazeno.stay";
  var KEY_STORE = "villazeno.stayKey";
  var PACK_STORE = "villazeno.stayPack";
  var OLD_CARD = "villazeno.stayCard";
  var fields = window.VZFields;
  var api = window.VZApi;

  function store(name, value) {
    try {
      if (value) localStorage.setItem(name, value);
      else localStorage.removeItem(name);
    } catch (e) {}
  }
  function read(name) {
    try { return localStorage.getItem(name) || ""; } catch (e) { return ""; }
  }
  function queryParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }

  // Resolve once: URL first (stored with its key), else storage.
  var id = queryParam("stay");
  var k = "";
  if (id) {
    k = queryParam("k");
    store(STAY_STORE, id);
    store(KEY_STORE, k);
  } else {
    id = read(STAY_STORE);
    k = id ? read(KEY_STORE) : "";
  }
  store(OLD_CARD, "");

  function readPack() {
    try {
      var pack = JSON.parse(read(PACK_STORE) || "null");
      return pack && pack.id === id && String(pack.k || "") === k ? pack : null;
    } catch (e) { return null; }
  }
  var cached = id ? readPack() : null;
  var snap = {
    id: id,
    k: k,
    state: id ? "loading" : "none",
    stay: cached ? cached.stay : null,
    items: cached ? cached.items || [] : null,
    error: null,
    stale: !!cached
  };
  var listeners = [];
  var inflight = null;

  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot()); } catch (e) {}
    });
  }
  function snapshot() {
    return {
      id: snap.id, k: snap.k, state: snap.state, stay: snap.stay,
      items: snap.items, error: snap.error, stale: snap.stale
    };
  }
  function forget() {
    store(STAY_STORE, "");
    store(KEY_STORE, "");
    store(PACK_STORE, "");
  }

  // Loads the stay and its demandes (action=list). Resolves the snapshot.
  function load(opts) {
    opts = opts || {};
    if (!snap.id) return Promise.resolve(snapshot());
    if (inflight && !opts.force) return inflight;
    if (snap.state !== "ok" || opts.force) {
      snap.state = "loading";
      snap.error = null;
      emit();
    }
    inflight = api.get({ action: "list", stay: snap.id, k: snap.k }, { timeout: opts.timeout || 20000, retries: opts.retries == null ? 2 : opts.retries }).then(function (result) {
      inflight = null;
      if (result.ok) {
        var data = result.data || {};
        snap.stay = data.stay || null;
        snap.items = Array.isArray(data.items) ? data.items : [];
        snap.state = "ok";
        snap.stale = false;
        snap.error = null;
        try { localStorage.setItem(PACK_STORE, JSON.stringify({ id: snap.id, k: snap.k, at: Date.now(), stay: snap.stay, items: snap.items })); } catch (e) {}
      } else if (result.kind === "invalid_link" || result.kind === "expired") {
        // Refused link: no data at all; the stored copy goes too.
        if (result.kind === "invalid_link") forget();
        else store(PACK_STORE, "");
        snap.stay = null;
        snap.items = null;
        snap.state = result.kind === "invalid_link" ? "invalid" : "expired";
        snap.error = result;
        snap.stale = false;
      } else {
        // Network / timeout / server: keep the last good copy (stale), show the error.
        snap.state = "error";
        snap.error = result;
        snap.stale = !!snap.stay;
      }
      emit();
      return snapshot();
    });
    return inflight;
  }

  // Name of the stay guest ("" when not known yet).
  function name() { return fields.guestName(snap.stay); }
  function firstName() { return fields.firstName(snap.stay); }

  window.GuestStay = {
    id: function () { return snap.id; },
    k: function () { return snap.k; },
    snapshot: snapshot,
    load: load,
    forget: forget,
    name: name,
    firstName: firstName,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
