// Apps Script (Code.v19.gs in the harness): Confirmer link opened twice for
// the four provider types (+ restauration / activité), refusals, lock
// contention, guest list fields, and every staff WhatsApp template.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createBackend, addDays } = require("./backend");

const D1 = addDays(2);
const D2 = addDays(3);
// details exactly as guest/js/requests.js writes them (sheetPayload).
const TYPES = {
  "transfert aéroport": { service: "transfert", sous_type: "arrivée", destinataire: "Hicham", details: { trip_type: "arrival", date: D1, flight_arrival_time: "15:30", pickup_time: "", passengers: 3, luggage: 2, vehicles: 1, flight_number: "AT800", origin_city: "Paris", baby_seats: 0 } },
  "transfert ville": { service: "course", sous_type: "en ville", destinataire: "Hicham", details: { passengers: 2, date: D2, pickup_time: "11:00", destination: "Gueliz", channel: "whatsapp", to: "Hicham" } },
  "location": { service: "location_voiture", sous_type: "citadine", destinataire: "Massillya", details: { start_date: D1, end_date: D2, pickup_time: "10:00", return_time: "10:00", car_type: "citadine", delivery: "villa", usage: "marrakech", agency: "Massillya" } },
  "massage": { service: "massage", sous_type: "relaxant", destinataire: "Massages & soins", details: { soins: [{ id: "relaxant", label: "Massage relaxant", minutes: "60 min", people: 1, price: 400 }], date: D2, time: "11:00" } },
  "restauration": { service: "restauration", sous_type: "dinner", destinataire: "Fouzia", details: { meal: "dinner", meal_label: "Dîner", date: D1, time: "20:00", time_label: "20 h", people: 4, adults: 4, dishes: [{ label: "Tajine végétarien", count: 4 }] } },
  "activité": { service: "activites", sous_type: "quad", destinataire: "Khalid", details: { activity: "quad", activity_label: "Excursion en quad", date: D2, time: "14:30", people: 2, vehicles: 1 } },
};

function post(b, id, t, extra) {
  const body = Object.assign({ stay: b.STAY_ID, k: b.key, id, token: "tok" + id, date_creation: new Date().toISOString(), nom_client: "Invité", total_dh: "" }, extra);
  body.details = Object.assign({ booking_id: b.STAY_ID, token: "tok" + id }, extra.details);
  return JSON.parse(b.box.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
}
function openHtml(b, id, token) {
  const out = b.box.ctx.doGet({ parameter: { action: "confirm", id, t: token } });
  const html = out.html || "";
  const h1 = (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "";
  const ps = [...html.matchAll(/<p style="margin:(?:8|6)px 0 0;[^"]*">([^<]*)<\/p>/g)].map((m) => m[1]);
  return { title: h1.replace(/&#39;|&amp;/g, (x) => (x === "&amp;" ? "&" : "'")), summary: ps[0] || "", note: ps[1] || "", html };
}
function openJson(b, id, token) {
  return JSON.parse(b.box.ctx.doGet({ parameter: { action: "confirm", id, t: token, format: "json" } }).text);
}

test("Confirmer link opened twice: « Demande confirmée » then « Demande déjà confirmée » + time, all types", (t) => {
  const b = createBackend();
  const rows = [];
  Object.entries(TYPES).forEach(([name, spec], i) => {
    const id = "c" + i + "x";
    assert.equal(post(b, id, null, spec).ok, true, name + " row written");
    const one = openHtml(b, id, "tok" + id);
    const two = openHtml(b, id, "tok" + id);
    const three = openJson(b, id, "tok" + id);
    rows.push([name, one.title, one.summary, two.title, two.note]);
    assert.equal(one.title, "Demande confirmée", name);
    assert.equal(two.title, "Demande déjà confirmée", name + " repeat open");
    assert.equal(two.summary, one.summary, name + " same summary");
    assert.match(two.note, /^Confirmée le \d{1,2} [a-zéû.]+ à \d{2}:\d{2}$/, name + " confirmation time");
    assert.doesNotMatch(one.summary + two.summary, /00:00/, name + " never 00:00");
    assert.equal(three.state, "already");
    assert.equal(three.title, "Demande déjà confirmée");
    assert.doesNotMatch(one.html, /tok|Léa|Bernard|\+33/, name + " no token / personal data on the page");
  });
  assert.match(rows[0][2], /^Transfert aéroport · arrivée · \d+ [^·]+ · 15:30 · 3 pers\.$/);
  assert.match(rows[1][2], /^Transfert en ville · \d+ [^·]+ · 11:00 · Gueliz · 2 pers\.$/);
  assert.match(rows[2][2], /^Location · Citadine · \d+ \S+ 10:00 → \d+ \S+ 10:00$/);
  assert.match(rows[3][2], /^Massage · \d+ [^·]+ · 11:00$/);
  t.diagnostic("type | open 1 | summary | open 2 | confirmation line");
  rows.forEach((r) => t.diagnostic(r.join(" | ")));
});

test("Confirmer: wrong token, cancelled demande, unknown id, JSON states", () => {
  const b = createBackend();
  post(b, "z1", null, TYPES.massage);
  assert.equal(openHtml(b, "z1", "nope").title, "Ce lien n’est pas valable.");
  assert.equal(openJson(b, "z1", "nope").state, "invalid");
  assert.equal(openHtml(b, "zz", "tokz1").title, "Ce lien n’est pas valable.");
  const row = b.box.sheets.Demandes.rows.find((r) => r[0] === "z1");
  row[8] = "Annulée";
  assert.equal(openHtml(b, "z1", "tokz1").title, "Cette demande a été annulée.");
  assert.equal(row[8], "Annulée", "an old link never revives a cancelled demande");
  post(b, "z2", null, TYPES.location);
  assert.deepEqual([openJson(b, "z2", "tokz2").state, openJson(b, "z2", "tokz2").state], ["confirmed", "already"]);
});

test("Confirmer under lock contention: branded « réessayez » page, never a thrown Google error", () => {
  const b = createBackend();
  post(b, "l1", null, TYPES.massage);
  b.box.ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, waitLock() { throw new Error("Lock timeout"); }, releaseLock() {} }) };
  let page;
  assert.doesNotThrow(() => { page = openHtml(b, "l1", "tokl1"); });
  assert.match(page.title, /réessayez/);
  assert.equal(openJson(b, "l1", "tokl1").state, "busy");
  assert.doesNotThrow(() => b.box.ctx.doPost({ postData: { contents: JSON.stringify({ stay: b.STAY_ID, k: b.key, id: "l2", details: {} }) } }));
});

test("guest list: real name, time per service, confirmation date; Sheet gets the real name", () => {
  const b = createBackend();
  post(b, "g1", null, TYPES["transfert aéroport"]);
  post(b, "g2", null, TYPES.location);
  openHtml(b, "g1", "tokg1");
  const r = JSON.parse(b.box.ctx.doGet({ parameter: { action: "list", stay: b.STAY_ID, k: b.key } }).text);
  assert.equal(r.ok, true);
  assert.equal(r.stay.nom, "Léa Bernard");
  assert.equal(r.stay.prenom, "Léa");
  const g1 = r.items.find((i) => i.id === "g1");
  const g2 = r.items.find((i) => i.id === "g2");
  assert.equal(g1.when_time, "15:30");
  assert.equal(g2.when_time, "10:00");
  assert.equal(g2.when_date, D1);
  assert.match(g1.date_confirmation, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(g1.status, "Confirmée");
  assert.equal(g1.nom_client, "Léa Bernard");
  b.demandes().forEach((d) => assert.equal(d.nom_client, "Léa Bernard", "no « Invité » in the Sheet"));
  assert.equal(JSON.stringify(r).includes("tokg1"), false, "token never listed");
});

test("staff WhatsApp templates: real name, HH:MM, no price, for every auto service", () => {
  const b = createBackend();
  [["restauration", TYPES.restauration], ["menage", { service: "menage", sous_type: "maison", destinataire: "Nadera", total_dh: "", details: { scope: "maison", scope_label: "Toute la maison", date: D1, time: "10:00" } }],
    ["piscine", { service: "piscine", sous_type: "nettoyage", destinataire: "Khalid", details: { areas: ["piscine"], areas_label: "Piscine", date: D1, time: "09:30" } }],
    ["activites", Object.assign({}, TYPES["activité"], { total_dh: 350 })]].forEach(([service, spec], i) => {
    const before = b.whatsapp.length;
    post(b, "w" + i, null, Object.assign({ total_dh: service === "restauration" ? 80 : "" }, spec, { details: Object.assign({ resume: "Total : 80 €\nNote : test" }, spec.details) }));
    const sent = b.whatsapp.slice(before);
    assert.ok(sent.length >= 1, service + " template sent (mocked)");
    sent.forEach((m) => {
      const params = m.payload.template.components[0].parameters.map((p) => p.text);
      assert.equal(params[1], "Léa Bernard", service + ": real guest name, never « Invité »");
      assert.match(params[2], /\d{2}:\d{2}/, service + ": time as HH:MM");
      assert.doesNotMatch(params.join(" "), /€|\bDH\b|\bMAD\b|\b80\b|\b350\b/i, service + ": no price");
      assert.doesNotMatch(JSON.stringify(m.payload), /Invit/, service);
    });
  });
});

test("guest POST is answered (not fire-and-forget): busy, refused and duplicate answers are readable", () => {
  const b = createBackend();
  const ok = post(b, "p1", null, TYPES.massage);
  assert.deepEqual([ok.ok, ok.id, ok.nom_client], [true, "p1", "Léa Bernard"]);
  assert.equal(post(b, "p1", null, TYPES.massage).duplicate, true);
  const bad = JSON.parse(b.box.ctx.doPost({ postData: { contents: JSON.stringify({ stay: b.STAY_ID, k: "0000000000000000", id: "p2", details: {} }) } }).text);
  assert.deepEqual(bad, { ok: false, error: "invalid_link" });
});
