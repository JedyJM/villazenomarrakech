// The production shape the old mock never had (2026-11-25 incident):
// admin signed in with Google (ADMIN_TEST_MODE false, real token path),
// real-looking Demandes rows, and the Demandes tab trimmed to its data
// (grid of 5 rows). The harness grid behaves like Sheets: getRange past
// the grid throws.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createBackend, addDays, CODE } = require("./backend");

const V20 = process.env.VZ_GAS_NEXT || "/workspace/sec/Code.v20.gs";

function rows(stay) {
  const d = (date, extra) => JSON.stringify(Object.assign({ token: "t" + date, booking_id: stay, date }, extra));
  return [
    ["dem00001", new Date().toISOString(), "transfert", "arrivée", "Invité", d(addDays(2), { trip_type: "arrival", flight_arrival_time: "15:30", passengers: 3 }), 350, "Hicham", "Envoyée", "", false],
    ["dem00002", new Date().toISOString(), "transfert", "arrivée", "Invité", d(addDays(2), { trip_type: "arrival", flight_arrival_time: "15:30", passengers: 2 }), 350, "Hicham", "Confirmée", "2026-11-25 14:34", false],
    ["dem00003", new Date().toISOString(), "massage", "decouverte", "Léa Bernard", d(addDays(1), { time: "22:57", soins: [{ id: "decouverte", people: 2, price: 300 }] }), 600, "Massages & soins", "Confirmée", "2026-11-25 20:58", false],
  ];
}
function get(b, params) { return JSON.parse(b.box.ctx.doGet({ parameter: params }).text); }

test("Google session (as in production) reads the real demandes: action=demandes, action=stays", () => {
  const b = createBackend({ session: "google", demandes: rows("LEA2611BX") });
  const dem = get(b, { action: "demandes", token: b.GOOGLE_TOKEN });
  assert.equal(dem.ok, true);
  assert.equal(dem.items.length, 3, "real rows are listed (no test-only filter for a Google session)");
  assert.equal(dem.confirmer, 1);
  assert.equal(get(b, { action: "stays", token: b.GOOGLE_TOKEN }).ok, true);
  assert.deepEqual(get(b, { action: "demandes", token: "forged" }), { ok: false, error: "forbidden" });
});

test("Code.v19 on the production Demandes grid (5 rows): every read throws (harness = real Sheets)", { skip: !/v19/.test(CODE) && "VZ_GAS_CODE is not v19" }, () => {
  const b = createBackend({ session: "google", demandes: rows("LEA2611BX"), maxRows: { Demandes: 5 } });
  assert.throws(() => b.box.ctx.doGet({ parameter: { action: "demandes", token: b.GOOGLE_TOKEN } }), /outside the dimensions/);
  assert.throws(() => b.box.ctx.doGet({ parameter: { action: "list", stay: b.STAY_ID, k: b.key } }), /outside the dimensions/);
});

test("Code.v20 (hotfix): production grid answers, and reads never write to the Sheet", { skip: !fs.existsSync(V20) && "no Code.v20.gs" }, () => {
  const b = createBackend({ code: V20, session: "google", demandes: rows("LEA2611BX"), maxRows: { Demandes: 5 } });
  const dem = b.box.sheets.Demandes;
  const res = b.box.sheets["Réservations"];
  const before = JSON.stringify(dem.rows) + JSON.stringify(res.rows);
  const out = get(b, { action: "demandes", token: b.GOOGLE_TOKEN });
  assert.equal(out.ok, true);
  assert.equal(out.items.length, 3);
  assert.equal(get(b, { action: "stays", token: b.GOOGLE_TOKEN }).ok, true);
  assert.equal(get(b, { action: "list", stay: b.STAY_ID, k: b.key }).items.length, 3);
  assert.deepEqual(dem.writes.concat(res.writes), [], "no checkbox / validation write on a read");
  assert.equal(JSON.stringify(dem.rows) + JSON.stringify(res.rows), before, "no cell written on a read");
  // A new guest demande still saves on the trimmed grid (the grid grows).
  const body = { stay: b.STAY_ID, k: b.key, id: "dem00004", token: "tk4", service: "menage", nom_client: "Invité", details: { booking_id: b.STAY_ID, date: addDays(3), time: "10:00" } };
  assert.equal(JSON.parse(b.box.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text).ok, true);
  assert.equal(dem.rows.length, 5);
});
