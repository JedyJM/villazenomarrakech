// Functional items of 2026-11-27 on the REAL script logic (Code.v21 candidate,
// VZ_GAS_CODE) in the gas harness, with the production Sheet shape (strict
// grids, real Réservations / Demandes headers). No Google, no Meta, no Gmail.
//   2. « Importer depuis Gmail »: create / update / cancel, no duplicate
//   3. free stay (0 €) accepted, « Offert », stats feed
//   4. stay edit: dates, 3 counters, amount, guest link dates, Sheet
//   5. meals: 3 counters + breakfast extras → Arabic staff WhatsApp, no price
//   6. staging switch, Sheet copy, test WhatsApp number, demo stay
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { makeSandbox, out } = require("../gas-harness");
const { block, CODE, ROOT } = require("./backend");

const SECRET = "func-secret-not-real-0123456789";
// Real production headers of « Réservations » (Gmail import + admin columns).
const RES = ["booking_id", "nom", "telephone", "date_arrivee", "date_depart", "source", "listing", "statut",
  "adultes", "enfants", "voyageurs", "notes", "total_voyageur", "devise",
  "airbnb_frais_chambre", "airbnb_reduction", "airbnb_frais_service", "airbnb_gain",
  "booking_montant", "booking_net", "gmail_id", "a_completer", "bien", "origine", "lien_actif", "lien_expire_le",
  "agence_nom", "ages_enfants", "booking_commission", "booking_frais_bancaires", "direct_tarif", "acompte_montant", "acompte_date", "acompte_mode", "reste_a_payer",
  "offert_petit_dejeuner", "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts",
  "chauffage_piscine_jours", "chauffage_piscine_tarif_eur", "chauffage_piscine_offert", "chauffage_jacuzzi_jours", "chauffage_jacuzzi_tarif_eur", "chauffage_jacuzzi_offert"];
const DEM = ["id", "date_creation", "service", "sous_type", "nom_client", "details_json", "total_dh", "destinataire", "statut", "date_confirmation", "offert"];
const GOOGLE = "google-token-func";

function source() {
  let text = fs.readFileSync(CODE, "utf8");
  const shared = block(fs.readFileSync(path.join(ROOT, "js", "vz-fields.js"), "utf8"));
  const own = block(text);
  if (own && shared) text = text.replace(own, () => shared);
  return text;
}
function row(o) { return RES.map((h) => (o[h] === undefined ? "" : o[h])); }
function keyOf(id) { return crypto.createHmac("sha256", SECRET).update(id, "utf8").digest("hex").slice(0, 16); }

function box(opts) {
  opts = opts || {};
  const sent = [];
  const b = makeSandbox({
    source: source(),
    now: opts.now || "2026-11-27T10:00:00Z",
    props: Object.assign({ LINK_SECRET: SECRET, WHATSAPP_TOKEN: "placeholder-not-a-token" }, opts.props || {}),
    // Strict grids like production: Demandes 1000 rows, Réservations its own size.
    maxRows: { Demandes: 1000, "Réservations": opts.resRows || 60 },
    sheets: { "Réservations": [RES].concat(opts.stays || []), Demandes: [DEM].concat(opts.demandes || []) },
    gmail: opts.gmail,
    fetch: (url, o) => {
      sent.push({ url, payload: JSON.parse(o.payload) });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id: "wamid.F" + sent.length }] }) };
    },
  });
  b.ctx.ADMIN_TEST_MODE = false;
  b.ctx.adminCheck_ = (t) => (t === GOOGLE ? { email: "admin@func.test", error: "" } : { email: "", error: "invalid_token" });
  b.sent = sent;
  b.post = (body) => out(b.ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
  b.get = (p) => out(b.ctx.doGet({ parameter: p }));
  b.stay = (id) => {
    const rows = b.sheets["Réservations"].rows;
    const head = rows[0];
    const r = rows.find((x) => String(x[head.indexOf("booking_id")]) === id);
    if (!r) return null;
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  };
  b.count = (id) => b.sheets["Réservations"].rows.filter((r) => String(r[0]) === id).length;
  return b;
}

// ---------- Gmail fixtures (synthetic, no real guest) ----------
const AIRBNB_CONFIRM = {
  id: "g1", from: "Airbnb <automated@airbnb.com>", date: "2026-11-20T09:00:00Z",
  subject: "Réservation confirmée : Claire Exemple arrive le 10 déc.",
  body: [
    "Nouvelle réservation confirmée ! Claire arrive le 10 déc.",
    "https://www.airbnb.fr/hosting/reservations/details/HMFUNC0001   Claire Exemple",
    "",
    "Villa Zen'O Palmeraie piscine chauffée",
    "Logement entier",
    "",
    "Arrivée   Départ",
    "jeu. 10 déc. 2026   lun. 14 déc. 2026",
    "",
    "VOYAGEURS",
    "2 adultes, 1 enfant",
    "",
    "CODE DE CONFIRMATION",
    "HMFUNC0001",
    "",
    "TOTAL (EUR)   1 200,00 €",
    "VERSEMENT DE L'HÔTE",
    "Frais de chambre   1 000,00 €",
    "Frais de service hôte   -155,00 €",
    "VOUS GAGNEZ   845,00 €",
  ].join("\n"),
};
const AIRBNB_CANCEL = {
  id: "g2", from: "Airbnb <automated@airbnb.com>", date: "2026-11-25T09:00:00Z",
  subject: "Réservation annulée HMFUNC0001 (10–14 déc. 2026)",
  body: [
    "RÉSERVATION ANNULÉE",
    "https://www.airbnb.fr/hosting/reservations/details/HMFUNC0001   Villa Zen'O Palmeraie piscine chauffée",
    "10–14 déc., 3 voyageurs",
  ].join("\n"),
};
const AIRBNB_SAME_DATES = {
  id: "g3", from: "Airbnb <automated@airbnb.com>", date: "2026-11-21T09:00:00Z",
  subject: "Réservation confirmée : Paul Exemple arrive le 20 déc.",
  body: AIRBNB_CONFIRM.body.replace(/HMFUNC0001/g, "HMFUNC0002").replace("Claire Exemple", "Paul Exemple")
    .replace("jeu. 10 déc. 2026   lun. 14 déc. 2026", "dim. 20 déc. 2026   dim. 27 déc. 2026"),
};

test("2. Importer depuis Gmail: creates the stay, a re-run adds nothing, clear counts", () => {
  const b = box({ gmail: [AIRBNB_CONFIRM] });
  const r1 = b.post({ action: "import-gmail", token: GOOGLE });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.deepEqual([r1.created, r1.updated, r1.cancelled], [1, 0, 0]);
  const s = b.stay("HMFUNC0001");
  assert.equal(s.nom, "Claire Exemple");
  assert.equal(s.date_arrivee, "2026-12-10");
  assert.equal(s.date_depart, "2026-12-14");
  assert.equal(s.origine, "gmail");
  assert.equal(s.lien_actif, true);
  const r2 = b.post({ action: "import-gmail", token: GOOGLE });
  assert.deepEqual([r2.created, r2.updated, r2.cancelled], [0, 0, 0], "second run: nothing new");
  assert.equal(b.count("HMFUNC0001"), 1, "no duplicate row");
  assert.equal(b.calls.triggers, undefined, "no trigger installed");
});

test("2. Importer depuis Gmail: cancellation e-mail → stay « annulée », guest link off, no duplicate", () => {
  const b = box({ gmail: [AIRBNB_CONFIRM] });
  b.post({ action: "import-gmail", token: GOOGLE });
  assert.equal(b.get({ action: "list", stay: "HMFUNC0001", k: keyOf("HMFUNC0001") }).ok, true, "link works before");
  b.calls.gmail = 0;
  // The cancellation arrives: both e-mails are in Gmail now.
  const b2 = b;
  b2.ctx.GmailApp = { search: (q, start) => (start || !/airbnb/.test(q) ? [] : [AIRBNB_CONFIRM, AIRBNB_CANCEL].map((m) => ({ getMessages: () => [{ getId: () => m.id, getFrom: () => m.from, getSubject: () => m.subject, getDate: () => new Date(m.date), getPlainBody: () => m.body }] }))) };
  const r = b2.post({ action: "import-gmail", token: GOOGLE });
  assert.equal(r.ok, true);
  assert.deepEqual([r.created, r.updated, r.cancelled], [0, 0, 1]);
  const s = b2.stay("HMFUNC0001");
  assert.equal(s.statut, "annulée");
  assert.equal(s.lien_actif, false, "guest link deactivated");
  assert.equal(b2.count("HMFUNC0001"), 1);
  assert.deepEqual(b2.get({ action: "list", stay: "HMFUNC0001", k: keyOf("HMFUNC0001") }), { ok: false, error: "expired" }, "guest link refused");
  const again = b2.post({ action: "import-gmail", token: GOOGLE });
  assert.deepEqual([again.created, again.updated, again.cancelled], [0, 0, 0], "re-run: still one cancelled row");
  // Cancelled stays never reach Stats (statut annulée, filtered by the admin).
  const stays = b2.get({ action: "stays-stats", token: GOOGLE }).stays;
  assert.match(String(stays.find((x) => x.id === "HMFUNC0001").statut), /annul/);
});

test("2. Importer depuis Gmail: a stay typed in the admin with the same dates is completed, not duplicated", () => {
  const b = box({
    gmail: [AIRBNB_SAME_DATES],
    stays: [row({ booking_id: "adm0000001", nom: "Paul (admin)", telephone: "+33600000001", date_arrivee: "2026-12-20", date_depart: "2026-12-27", source: "Airbnb", bien: "Villa Zen'O", origine: "admin", lien_actif: true })],
  });
  const r = b.post({ action: "import-gmail", token: GOOGLE });
  assert.equal(r.ok, true);
  assert.deepEqual([r.created, r.updated, r.cancelled], [0, 1, 0]);
  assert.equal(b.sheets["Réservations"].rows.length, 2, "header + the admin row only");
  const s = b.stay("adm0000001");
  assert.equal(s.nom, "Paul (admin)", "typed name kept");
  assert.equal(s.code_plateforme, "HMFUNC0002", "platform code linked");
  assert.equal(s.airbnb_gain, 845, "empty amounts filled from the e-mail");
  const r2 = b.post({ action: "import-gmail", token: GOOGLE });
  assert.deepEqual([r2.created, r2.updated], [0, 0], "re-run matches through code_plateforme");
});

test("2. Importer depuis Gmail: refused without a Google session (test session outside staging)", () => {
  const b = box({ gmail: [AIRBNB_CONFIRM] });
  b.ctx.ADMIN_TEST_MODE = true;
  assert.deepEqual(b.post({ action: "import-gmail", token: "test", test: "1" }), { ok: false, error: "forbidden" });
  assert.deepEqual(b.post({ action: "import-gmail", token: "nope" }), { ok: false, error: "forbidden" });
  assert.equal(b.count("HMFUNC0001"), 0);
});

test("2. Importer depuis Gmail: a Gmail failure is a clear error, never a Google page", () => {
  const b = box();
  b.ctx.GmailApp = { search: () => { throw new Error("Gmail: permission required"); } };
  const r = b.post({ action: "import-gmail", token: GOOGLE });
  assert.equal(r.ok, false);
  assert.equal(r.error, "gmail");
});

function stayBody(extra) {
  return Object.assign({
    booking_id: "", nom: "Famille Offerte", telephone: "+33600000002", date_arrivee: "2026-12-05", date_depart: "2026-12-08",
    source: "Direct", adultes: 2, enfants: 2, enfants_4_11: 1, enfants_moins_4: 1, lien_actif: true, lien_expire_le: "2026-12-11",
    direct_tarif: 0, acompte_montant: 0, reste_a_payer: 0, sejour_offert: true,
  }, extra || {});
}

test("3. free stay: amount 0 accepted at creation, kept as 0, « Offert » in the stays feed", () => {
  const b = box();
  const r = b.post({ action: "save-stay", token: GOOGLE, stay: stayBody() });
  assert.equal(r.ok, true, JSON.stringify(r));
  const s = b.stay(r.id);
  assert.equal(s.direct_tarif, 0, "0 stays 0, not empty");
  assert.equal(s.sejour_offert, true);
  const feed = b.get({ action: "stays", token: GOOGLE }).stays.find((x) => x.id === r.id);
  assert.equal(feed.freeStay, true);
  assert.equal(feed.tarif, 0);
  assert.deepEqual([feed.kids4to11, feed.kidsUnder4], [1, 1]);
  const stats = b.get({ action: "stays-stats", token: GOOGLE }).stays.find((x) => x.id === r.id);
  assert.ok(stats, "a free stay counts in Stats (nights, occupancy)");
  assert.equal(stats.freeStay, true);
});

test("4. stay edit: dates, 3 counters, amount → Sheet, admin feed and guest link (validity)", () => {
  const b = box({ stays: [row({ booking_id: "HMEDIT0001", nom: "Gmail Sans Tel", date_arrivee: "2026-12-01", date_depart: "2026-12-04", source: "Booking.com", bien: "Villa Zen'O", origine: "gmail", lien_actif: true, lien_expire_le: "2026-12-07", a_completer: "à compléter", adultes: "", enfants: "" })] });
  const k = keyOf("HMEDIT0001");
  assert.equal(b.get({ action: "list", stay: "HMEDIT0001", k }).stay.departure, "2026-12-04");
  const r = b.post({ action: "save-stay", token: GOOGLE, stay: { booking_id: "HMEDIT0001", nom: "Gmail Sans Tel", telephone: "", date_arrivee: "2026-12-02", date_depart: "2026-12-09", source: "Booking", adultes: 3, enfants: 2, enfants_4_11: 2, enfants_moins_4: 0, booking_montant: 1500, booking_commission: 225, booking_frais_bancaires: 30, booking_net: 1245, lien_actif: true, lien_expire_le: "2026-12-12" } });
  assert.equal(r.ok, true);
  assert.equal(b.count("HMEDIT0001"), 1, "updated in place");
  const s = b.stay("HMEDIT0001");
  assert.deepEqual([s.date_arrivee, s.date_depart, s.adultes, s.enfants_4_11, s.enfants_moins_4, s.booking_montant, s.lien_expire_le], ["2026-12-02", "2026-12-09", 3, 2, 0, 1500, "2026-12-12"]);
  assert.equal(s.a_completer, "", "completed in the admin: no longer « à compléter »");
  const guest = b.get({ action: "list", stay: "HMEDIT0001", k });
  assert.equal(guest.ok, true);
  assert.deepEqual([guest.stay.arrival, guest.stay.departure, guest.stay.lien_expire_le, guest.stay.adults, guest.stay.children_4_11, guest.stay.under_4], ["2026-12-02", "2026-12-09", "2026-12-12", 3, 2, 0]);
});

test("4/5. old rows: ages_enfants still read as counters (stay and meal)", () => {
  const F = require("../../js/vz-fields.js");
  assert.deepEqual(F.stayKids({ enfants: 3, ages_enfants: "2,7,13" }), { de_4_a_11: 1, moins_4: 1, plus_12: 1 });
  assert.deepEqual(F.stayKids({ enfants: 2, ages_enfants: "" }), { de_4_a_11: 2, moins_4: 0, plus_12: 0 });
  assert.deepEqual(F.mealKids({ children_ages: { plus_12: 1, de_4_a_11: 2, moins_4: 0 } }), { de_4_a_11: 2, moins_4: 0, plus_12: 1 });
  assert.deepEqual(F.mealKids({ enfants_4_11: 1, enfants_moins_4: 2 }), { de_4_a_11: 1, moins_4: 2, plus_12: 0 });
  assert.equal(F.extrasText({ extras: { fruit_bowl: true, tajine_eggs: 2 } }), "Coupe de fruits frais · 2 œufs façon tajine");
});

const STAY = row({ booking_id: "LEAFUNC01", nom: "Léa Bernard", date_arrivee: "2026-11-26", date_depart: "2026-12-03", source: "Airbnb", bien: "Villa Zen'O", origine: "admin", lien_actif: true, adultes: 2, enfants: 2 });

function breakfast(id) {
  return {
    stay: "LEAFUNC01", k: keyOf("LEAFUNC01"), id: id || "bf" + Date.now(), token: "tok" + Math.random().toString(36).slice(2, 10),
    date_creation: "2026-11-27T10:00:00Z", service: "restauration", sous_type: "breakfast", nom_client: "Invité",
    details: {
      meal: "breakfast", date: "2026-11-28", time: "09:30", time_label: "9 h 30", people: 4, adults: 2, children: 2,
      enfants_4_11: 1, enfants_moins_4: 1, extras: { fruit_bowl: true, tajine_eggs: 2 },
      eggs: { dur: 1, brouille: 1, au_plat: 0 }, eggs_label: "1 Dur, 1 Brouillé",
      resume: ["Repas : Petit-déjeuner", "Date : samedi 28 novembre", "Heure : 9 h 30", "Œufs : 1 Dur, 1 Brouillé", "Personnes : 4", "Adultes : 2",
        "Enfants 4 à 11 ans : 1", "Enfants moins de 4 ans : 1", "Coupe de fruits frais : 1", "Œufs façon tajine : 2"].join("\n"),
    },
    total_dh: 50, destinataire: "Fouzia",
  };
}

test("5. meals: 3 counters + extras → Sheet row and Arabic staff WhatsApp with NO price", () => {
  const b = box({ stays: [STAY] });
  const r = b.post(breakfast("bfA"));
  assert.equal(r.ok, true, JSON.stringify(r));
  const dem = b.sheets.Demandes.rows[1];
  const d = JSON.parse(dem[5]);
  assert.deepEqual([d.enfants_4_11, d.enfants_moins_4, d.extras.fruit_bowl, d.extras.tajine_eggs], [1, 1, true, 2]);
  assert.equal(d.children_ages, undefined, "no more children_ages on new rows");
  assert.equal(dem[6], 50, "total (€ for meals) kept in the Sheet");
  assert.ok(b.sent.length >= 1, "staff WhatsApp sent (captured)");
  for (const m of b.sent) {
    const params = m.payload.template.components[0].parameters.map((p) => p.text);
    const all = params.join(" | ");
    assert.doesNotMatch(all, /€|\bEUR\b|\bDH\b|\bMAD\b|50/, "no price in a staff message: " + all);
    assert.match(all, /أطفال من 4 إلى 11 سنة|طفل 4-11 سنة/, "4-11 counter in Arabic");
    assert.match(all, /أقل من 4 سنوات/, "under-4 counter in Arabic");
    assert.match(all, /صحن فواكه طازجة للمائدة : 1/, "fruit bowl in Arabic");
    assert.match(all, /بيض على طريقة الطاجين : 2/, "tajine eggs in Arabic");
    assert.doesNotMatch(params[3], /[A-Za-zÀ-ÿ]{3,}/, "details fully Arabic (no French word): " + params[3]);
  }
  // Admin Demandes item: counters + extras text (admin only).
  const item = b.get({ action: "demandes", token: GOOGLE }).items.find((x) => x.id === "bfA");
  assert.deepEqual([item.kids_4_11, item.kids_under_4, item.extras], [1, 1, "Coupe de fruits frais · 2 œufs façon tajine"]);
});

test("5. old meal rows (children_ages) still render for staff and admin", () => {
  const b = box({ stays: [STAY] });
  const old = breakfast("bfOld");
  delete old.details.enfants_4_11;
  delete old.details.enfants_moins_4;
  old.details.children_ages = { plus_12: 1, de_4_a_11: 1, moins_4: 0 };
  assert.equal(b.post(old).ok, true);
  const item = b.get({ action: "demandes", token: GOOGLE }).items.find((x) => x.id === "bfOld");
  assert.equal(item.kids_4_11, 1);
});

test("6. staging: WhatsApp only to TEST_WA_NUMBER, nobody without it, Sheet copy id", () => {
  const b = box({ stays: [STAY], props: { STAGING: "true", TEST_WA_NUMBER: "+33 6 00 00 00 99", SHEET_ID: "sheet-copy-id" } });
  assert.equal(b.post(breakfast("bfS1")).ok, true);
  assert.deepEqual(b.sent.map((m) => m.payload.to), ["33600000099"], "one message, to the test number only");
  assert.ok(b.calls.openById.every((id) => id === "sheet-copy-id"), "only the Sheet copy is opened");
  const none = box({ stays: [STAY], props: { STAGING: "true" } });
  assert.equal(none.post(breakfast("bfS2")).ok, true);
  assert.equal(none.sent.length, 0, "staging without TEST_WA_NUMBER: nothing sent");
  const prod = box({ stays: [STAY] });
  assert.ok(prod.calls.openById === undefined || prod.calls.openById.length === 0);
  prod.post(breakfast("bfP"));
  assert.ok(prod.calls.openById.every((id) => id === "1bd3xmrdjz7_Ae8xiu__OuxKUliQUWCvYg8i7J1ugMj8"), "production: the constant Sheet id");
});

test("6. staging: installRecapTrigger refused, stagingCheck removes recap / Gmail triggers", () => {
  const b = box({ props: { STAGING: "true" } });
  assert.throws(() => b.ctx.installRecapTrigger(), /STAGING/);
  assert.equal((b.calls.triggers || []).length, 0);
  b.calls.triggers = ["sendDailyRecap_", "markDemandesTerminees"];
  b.ctx.stagingCheck();
  assert.deepEqual(b.calls.triggers, ["markDemandesTerminees"]);
});

test("6. admin test mode from a Script Property: staging only", () => {
  const stg = box({ props: { STAGING: "true", ADMIN_TEST_MODE: "true" } });
  assert.equal(stg.ctx.adminTestMode_(), true);
  const prod = box({ props: { ADMIN_TEST_MODE: "true" } });
  assert.equal(prod.ctx.adminTestMode_(), false, "ignored in production");
  assert.deepEqual(prod.get({ action: "stays", token: "test", test: "1" }), { ok: false, error: "forbidden" });
});

test("6. « Famille Démo »: seed is idempotent, 1–15 Dec 2028, guest link works, never in Stats", () => {
  const b = box({ props: { STAGING: "true" }, stays: [STAY] });
  const r1 = b.ctx.seedDemoStay_();
  const r2 = b.ctx.seedDemoStay_();
  assert.equal(r1.ok && r2.ok, true);
  assert.deepEqual([r1.created, r2.created], [true, false]);
  assert.equal(b.count("FAMDEMO2812"), 1);
  const s = b.stay("FAMDEMO2812");
  assert.deepEqual([s.nom, s.date_arrivee, s.date_depart, s.origine, s.telephone], ["Famille Démo", "2028-12-01", "2028-12-15", "test", ""]);
  const guest = b.get({ action: "list", stay: "FAMDEMO2812", k: keyOf("FAMDEMO2812") });
  assert.equal(guest.ok, true);
  assert.deepEqual([guest.stay.adults, guest.stay.children_4_11, guest.stay.under_4], [2, 1, 1]);
  const stats = b.get({ action: "stays-stats", token: GOOGLE }).stays;
  assert.equal(stats.some((x) => x.id === "FAMDEMO2812"), false, "out of Stats");
  // Even with its origine changed by hand, the demo stays out of Stats.
  const head = b.sheets["Réservations"].rows[0];
  const rr = b.sheets["Réservations"].rows.find((x) => x[0] === "FAMDEMO2812");
  rr[head.indexOf("origine")] = "admin";
  assert.equal(b.get({ action: "stays-stats", token: GOOGLE }).stays.some((x) => x.id === "FAMDEMO2812"), false);
  // Admin seed action: staging only.
  assert.equal(b.post({ action: "seed-demo", token: GOOGLE }).ok, true);
  assert.deepEqual(box().post({ action: "seed-demo", token: GOOGLE }), { ok: false, error: "forbidden" });
});

test("6. /exec per environment: production URL by default, preview only through VZ_EXEC_URL", async () => {
  const { execUrlFor } = await import("../../api/vz-env.js");
  const staging = "https://script.google.com/macros/s/AKfycbStagingDeploymentId_123456789/exec";
  assert.equal(execUrlFor({ VERCEL_ENV: "production", VZ_EXEC_URL: staging }), "", "never in production");
  assert.equal(execUrlFor({ VERCEL_ENV: "preview", VZ_EXEC_URL: staging }), staging);
  assert.equal(execUrlFor({ VERCEL_ENV: "preview", VZ_EXEC_URL: "https://evil.example/exec" }), "", "only an Apps Script /exec");
  assert.equal(execUrlFor({ VERCEL_ENV: "preview" }), "");
  // js/vz-api.js: host rule (same code as the browser).
  const vm = require("node:vm");
  const ctx = { setTimeout, clearTimeout, Promise, location: { hostname: "www.villazenomarrakech.com" } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "vz-api.js"), "utf8").replace("})(window);", "})(this);"), ctx);
  const api = ctx.VZApi;
  assert.equal(await api.urlReady, api.PROD_URL, "www: production URL, no lookup");
  assert.equal(api.isPreviewHost("villazenomarrakech.vercel.app"), false);
  assert.equal(api.isPreviewHost("www.villazenomarrakech.com"), false);
  assert.equal(api.isPreviewHost("localhost"), false);
  assert.equal(api.isPreviewHost("villazenomarrakech-git-func-2026-11-27-jedyjm.vercel.app"), true);
  assert.match(api.PROD_URL, /AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/, "production /exec unchanged");
});
