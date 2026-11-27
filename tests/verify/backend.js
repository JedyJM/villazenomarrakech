// Mock /exec for the verification suite. Nothing real: no Google, no Meta.
// It runs the real script logic (Code.v19.gs) in the gas harness, with its
// VZ_FIELDS block replaced by the block of js/vz-fields.js (the site's
// shared field model; fields.test.js proves the two are identical).
// WhatsApp Graph calls (UrlFetchApp) are captured, never sent.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { makeSandbox } = require("../gas-harness");

const ROOT = path.join(__dirname, "..", "..");
const CODE = process.env.VZ_GAS_CODE || "/workspace/sec/Code.v21.gs";
const SECRET = "verify-secret-not-real-0123456789";
const RES_HEADERS = ["booking_id", "nom", "telephone", "date_arrivee", "date_depart", "source", "adultes", "enfants", "bien", "origine", "lien_actif", "lien_expire_le",
  "chauffage_piscine_jours", "chauffage_piscine_tarif_eur", "chauffage_piscine_offert", "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts"];
// Production shape of « Réservations » (Gmail import columns first, then the
// admin columns, as the live tab on 2026-11-27). opts.realShape uses it.
const RES_REAL = ["booking_id", "nom", "telephone", "date_arrivee", "date_depart", "source", "listing", "statut",
  "adultes", "enfants", "voyageurs", "notes", "total_voyageur", "devise",
  "airbnb_frais_chambre", "airbnb_reduction", "airbnb_frais_service", "airbnb_gain",
  "booking_montant", "booking_net", "gmail_id", "a_completer", "bien", "origine", "lien_actif", "lien_expire_le",
  "agence_nom", "ages_enfants", "booking_commission", "booking_frais_bancaires", "direct_tarif", "acompte_montant", "acompte_date", "acompte_mode", "reste_a_payer",
  "offert_petit_dejeuner", "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts",
  "chauffage_piscine_jours", "chauffage_piscine_tarif_eur", "chauffage_piscine_offert", "chauffage_jacuzzi_jours", "chauffage_jacuzzi_tarif_eur", "chauffage_jacuzzi_offert"];
function realRow(o) { return RES_REAL.map((h) => (o[h] === undefined ? "" : o[h])); }
/* « Vraies listes de demandes »: n past / future demandes of other stays
   (every service, every status), like the live Demandes tab. */
function realDemandes(n) {
  const services = [["restauration", "lunch", 30], ["menage", "maison", ""], ["piscine", "nettoyage", ""], ["activites", "quad", 300], ["transfert", "arrivée", 350], ["massage", "decouverte", 600]];
  const statuses = ["Envoyée", "Confirmée", "Terminée", "Annulée"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [service, sous, total] = services[i % services.length];
    const date = addDays((i % 21) - 14);
    out.push(["old" + String(i).padStart(5, "0"), new Date(Date.now() - (n - i) * 3600e3).toISOString(), service, sous, ["Martin", "Dubois", "Lefèvre", "Moreau", "Laurent"][i % 5] + " (exemple)",
      JSON.stringify(Object.assign({ booking_id: "OLDSTAY" + (i % 5), token: "tok" + i, date, time: "12:00" }, service === "transfert" ? { trip_type: "arrival", flight_arrival_time: "12:00" } : {}, service === "restauration" ? { meal: "lunch", adults: 2 } : {})),
      total, ({ restauration: "Fouzia", menage: "Nadera", piscine: "Khalid", activites: "Khalid", transfert: "Hicham", massage: "Massages & soins" })[service], statuses[i % statuses.length], "", false]);
  }
  return out;
}
const DEM_HEADERS = ["id", "date_creation", "service", "sous_type", "nom_client", "details_json", "total_dh", "destinataire", "statut", "date_confirmation", "offert"];

function block(text) {
  const a = text.indexOf("// BEGIN VZ_FIELDS");
  const b = text.indexOf("// END VZ_FIELDS");
  if (a < 0 || b < 0) return null;
  return text.slice(a, b + "// END VZ_FIELDS".length);
}

function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

const STAY_ID = "LEA2611BX";
const GUEST = "Léa Bernard";

/* Fake Google ID token for the « session Google » mode (as in production:
   ADMIN_TEST_MODE false, real admin token). Not a real token: the mock
   accepts exactly this string through adminCheck_, nothing else. */
const GOOGLE_TOKEN = "eyJhbGciOiJSUzI1NiJ9." + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url") + ".verify-not-a-signature";

function keyOf(id) { return crypto.createHmac("sha256", SECRET).update(id, "utf8").digest("hex").slice(0, 16); }

function createBackend(opts) {
  opts = opts || {};
  let source = fs.readFileSync(opts.code || CODE, "utf8");
  const shared = block(fs.readFileSync(path.join(ROOT, "js", "vz-fields.js"), "utf8"));
  const own = block(source);
  if (own && shared) source = source.replace(own, () => shared);
  const whatsapp = [];
  const real = !!opts.realShape;
  const testStay = real
    ? realRow({ booking_id: STAY_ID, nom: GUEST, telephone: "+33600000000", date_arrivee: addDays(-1), date_depart: addDays(7), source: "Airbnb", adultes: 2, enfants: 0, bien: "Villa Zen'O", origine: "test", lien_actif: true, chauffage_piscine_jours: 3, chauffage_piscine_tarif_eur: 60, chauffage_piscine_offert: false, airbnb_frais_chambre: 1000, airbnb_gain: 845, total_voyageur: 1200, devise: "EUR" })
    : [STAY_ID, GUEST, "+33600000000", addDays(-1), addDays(7), "Airbnb", 2, 0, "Villa Zen'O", "test", true, "", 3, 60, false, "", "", "", ""];
  const box = makeSandbox({
    source,
    props: Object.assign({ LINK_SECRET: SECRET, WHATSAPP_TOKEN: "placeholder-not-a-token" }, opts.props || {}),
    // Real grids (opts.maxRows, e.g. { Demandes: 5 } = the production tab on 2026-11-25).
    maxRows: opts.maxRows || (real ? { Demandes: 1000, "Réservations": 200 } : undefined),
    gmail: opts.gmail,
    sheets: {
      // The test stay of the journey (origine test: reachable in admin test mode).
      "Réservations": [real ? RES_REAL : RES_HEADERS, testStay].concat((opts.stays || []).map((o) => (Array.isArray(o) ? o : realRow(o)))),
      Demandes: [DEM_HEADERS].concat(real ? realDemandes(opts.realDemandes == null ? 60 : opts.realDemandes) : []).concat(opts.demandes || []),
    },
    fetch: (url, o) => {
      whatsapp.push({ url, payload: JSON.parse(o.payload) });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id: "wamid.TEST" + whatsapp.length }] }) };
    },
  });
  if (opts.session === "google") {
    // Production: ADMIN_TEST_MODE false, the admin signs in with Google.
    box.ctx.ADMIN_TEST_MODE = false;
    box.ctx.adminCheck_ = (token) => (String(token) === GOOGLE_TOKEN ? { email: "admin@verify.test", error: "" } : { email: "", error: "invalid_token" });
  } else {
    box.ctx.ADMIN_TEST_MODE = true; // admin « Mode test » session (token=test, test=1)
  }
  box.ctx.notifyNewDemande_ = () => {};
  // WhatsApp staff messages go to the test number only, like the live test mode.
  const faults = [];
  const log = [];
  function fault(match, mode) { faults.push({ match, mode, used: false }); }
  function takeFault(params) {
    for (const f of faults) {
      if (f.used && !f.mode.sticky) continue;
      const hit = typeof f.match === "function" ? f.match(params) : params.action === f.match;
      if (hit) { if (!f.mode.sticky) f.used = true; return f.mode; }
    }
    return null;
  }
  function run(method, params, body) {
    if (method === "GET") return box.ctx.doGet({ parameter: params });
    return box.ctx.doPost({ postData: { contents: body } });
  }
  // Playwright route handler for https://script.google.com/macros/**.
  async function route(route) {
    const req = route.request();
    const url = new URL(req.url());
    const params = Object.fromEntries(url.searchParams.entries());
    const body = req.method() === "POST" ? (req.postData() || "{}") : "";
    let parsed = params;
    if (body) { try { parsed = JSON.parse(body); } catch (e) { parsed = {}; } }
    const entry = { method: req.method(), action: parsed.action || (body ? "demande" : ""), params: parsed, at: Date.now() };
    log.push(entry);
    const mode = takeFault(Object.assign({ method: req.method() }, parsed, { action: entry.action }));
    // Apps Script answers in 0.3–1.5 s in production: opts.latency [min, max] ms.
    if (opts.latency) await new Promise((r) => setTimeout(r, opts.latency[0] + Math.random() * (opts.latency[1] - opts.latency[0])));
    entry.started = Date.now();
    if (mode && mode.delay) await new Promise((r) => setTimeout(r, mode.delay));
    if (mode && mode.abort) return route.abort("failed");
    if (mode && mode.status) return route.fulfill({ status: mode.status, contentType: "text/html", body: "<html>Erreur</html>" });
    if (mode && mode.body !== undefined) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: mode.body });
    if (mode && mode.json) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(mode.json) });
    let out;
    try {
      if (mode && mode.exception) throw new Error(mode.exception);
      out = run(req.method(), params, body);
    } catch (err) {
      // Like the live web app: an uncaught exception is Google's HTML
      // error page, without CORS header (the browser sees a network error).
      entry.answer = { exception: String(err && err.message || err) };
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<html><body>Erreur : " + String(err && err.message || err).replace(/</g, "&lt;") + "</body></html>" });
    }
    entry.answer = out.text ? JSON.parse(out.text) : { html: true };
    entry.done = Date.now();
    if (out.html !== undefined) {
      // HtmlService page: served by Google without CORS (like the live script).
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: out.html });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: out.text });
  }
  function demandes() {
    return box.sheets.Demandes.rows.slice(1).map((r) => {
      const o = {};
      DEM_HEADERS.forEach((h, i) => { o[h] = r[i]; });
      try { o.details = JSON.parse(o.details_json || "{}"); } catch (e) { o.details = {}; }
      return o;
    });
  }
  function stayRow(id) {
    const rows = box.sheets["Réservations"].rows;
    const head = rows[0];
    const r = rows.find((row) => String(row[0]) === id);
    if (!r) return null;
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  }
  function inflightMax(action) {
    // Highest number of requests of one action running at the same time.
    const spans = log.filter((e) => e.action === action && e.started).map((e) => [e.started, e.done || Infinity]);
    let max = 0;
    for (const [a] of spans) max = Math.max(max, spans.filter(([x, y]) => x <= a && a < y).length);
    return max;
  }
  return { GOOGLE_TOKEN, inflightMax, route, fault, faults, log, whatsapp, demandes, stayRow, box, STAY_ID, GUEST, key: keyOf(STAY_ID), keyOf, addDays };
}

module.exports = { GOOGLE_TOKEN, DEM_HEADERS, RES_REAL, realRow, createBackend, block, STAY_ID, GUEST, keyOf, addDays, CODE, ROOT };
