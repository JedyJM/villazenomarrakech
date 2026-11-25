// One shared field model: js/vz-fields.js (site + mock) == Code.v19.gs block.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { block, CODE, ROOT } = require("./backend");
const F = require("../../js/vz-fields.js");

test("field model: Code.v19.gs carries the exact block of js/vz-fields.js", () => {
  const site = block(fs.readFileSync(path.join(ROOT, "js", "vz-fields.js"), "utf8"));
  const script = block(fs.readFileSync(CODE, "utf8"));
  assert.ok(site, "block in js/vz-fields.js");
  assert.ok(script, "block in " + CODE);
  assert.equal(script, site, "the VZ_FIELDS block differs between the site and the script");
});

test("field model: the script copy behaves like the site copy", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(block(fs.readFileSync(CODE, "utf8")), ctx);
  const cases = [
    ["transfert", { trip_type: "arrival", date: "2026-11-27", flight_arrival_time: "15:30", passengers: 3 }],
    ["transfert", { trip_type: "departure", date: "2026-11-28", pickup_time: "9:05" }],
    ["course", { date: "2026-11-28", pickup_time: "11:00", destination: "Gueliz", passengers: 2 }],
    ["location_voiture", { start_date: "2026-11-28", pickup_time: "10:00", end_date: "2026-11-29", return_time: "10:00", car_type: "citadine" }],
    ["massage", { date: "2026-11-28", time: "11:00", soins: [{ id: "relaxant" }] }],
    ["restauration", { meal: "breakfast", date: "2026-11-27", time: "08:30", time_label: "8 h 30", people: 3 }],
    ["menage", { date: "2026-11-27" }],
  ];
  for (const [service, d] of cases) {
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.vzfWhen_(service, d))), F.when(service, d));
    assert.equal(ctx.vzfConfirmSummary_(service, d), F.confirmSummary(service, d));
  }
});

test("times: one rule per service, never a made-up 00:00", () => {
  assert.deepEqual(F.when("transfert", { trip_type: "arrival", date: "2026-11-27", flight_arrival_time: "15:30" }), { date: "2026-11-27", time: "15:30" });
  assert.deepEqual(F.when("transfert", { trip_type: "departure", date: "2026-11-27", pickup_time: "07:15" }), { date: "2026-11-27", time: "07:15" });
  assert.deepEqual(F.when("course", { date: "2026-11-28", pickup_time: "11:00" }), { date: "2026-11-28", time: "11:00" });
  assert.deepEqual(F.when("location_voiture", { start_date: "2026-11-28", pickup_time: "10:00" }), { date: "2026-11-28", time: "10:00" });
  assert.deepEqual(F.when("restauration", { date: "2026-11-27", time_label: "9 h 30" }), { date: "2026-11-27", time: "09:30" });
  assert.equal(F.when("menage", { date: "2026-11-27" }).time, "", "no time stays empty");
  assert.equal(F.clock(""), "");
  assert.equal(F.clock("abc"), "");
  assert.equal(F.clock("25:00"), "");
});

test("confirm summaries for the four provider types", () => {
  assert.equal(F.confirmSummary("transfert", { trip_type: "arrival", date: "2026-11-27", flight_arrival_time: "15:30", passengers: 3 }), "Transfert aéroport · arrivée · 27 nov. · 15:30 · 3 pers.");
  assert.equal(F.confirmSummary("course", { date: "2026-11-28", pickup_time: "11:00", destination: "Gueliz", passengers: 2 }), "Transfert en ville · 28 nov. · 11:00 · Gueliz · 2 pers.");
  assert.equal(F.confirmSummary("location_voiture", { start_date: "2026-11-28", pickup_time: "10:00", end_date: "2026-11-29", return_time: "10:00", car_type: "citadine" }), "Location · Citadine · 28 nov. 10:00 → 29 nov. 10:00");
  assert.equal(F.confirmSummary("massage", { date: "2026-11-28", time: "11:00" }), "Massage · 28 nov. · 11:00");
});

test("names and confirmation date", () => {
  assert.equal(F.isPlaceholderName("Invité"), true);
  assert.equal(F.isPlaceholderName("Guest"), true);
  assert.equal(F.isPlaceholderName("Léa Bernard"), false);
  assert.equal(F.guestName({ prenom: "Léa", nom: "Léa Bernard" }), "Léa Bernard");
  assert.equal(F.firstName({ nom: "Léa Bernard" }), "Léa");
  assert.equal(F.confirmedText("2026-11-25 14:32"), "Confirmée le 25 nov. à 14:32");
  assert.equal(F.confirmedText("2026-11-25"), "Confirmée le 25 nov.");
  assert.equal(F.confirmedText(""), "");
});

test("public stay: name, encaissement and heating fields", () => {
  const s = F.publicStay({ booking_id: "X1", nom: "Léa Bernard", date_arrivee: "2026-11-24", date_depart: "2026-12-02", encaisse_le: "2026-12-02", encaisse_mode: "Espèces €", encaisse_total_eur: 180, offerts: "taxe, diner", chauffage_piscine_jours: 3, chauffage_piscine_tarif_eur: 60 });
  assert.equal(s.nom, "Léa Bernard");
  assert.equal(s.prenom, "Léa");
  assert.equal(s.encaisse_le, "2026-12-02");
  assert.deepEqual(s.offerts, ["taxe", "diner"]);
  assert.deepEqual(s.pool, { days: 3, rate: 60, offert: false });
  assert.deepEqual(Object.keys(s).sort(), F.STAY_FIELDS.slice().sort());
});
