// Admin as in PRODUCTION (iPhone 15 WebKit, /exec mocked with real v19
// logic): Google session (ADMIN_TEST_MODE false, real token path, real
// demandes), not the « Mode test » session the other journeys use.
// 2026-11-25: Demandes stayed on « Chargement des demandes… » with
// « À confirmer 0 »; the old suite only ever ran token=test.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, createBackend, browser, day } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("pages"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

function rows(stay) {
  const d = (date, extra) => JSON.stringify(Object.assign({ token: "t" + date, booking_id: stay, date }, extra));
  return [
    ["dem00001", new Date().toISOString(), "transfert", "arrivée", "Invité", d(day(2), { trip_type: "arrival", flight_arrival_time: "15:30", passengers: 3 }), 350, "Hicham", "Envoyée", "", false],
    ["dem00002", new Date().toISOString(), "transfert", "arrivée", "Invité", d(day(2), { trip_type: "arrival", flight_arrival_time: "15:30", passengers: 2 }), 350, "Hicham", "Confirmée", day(0) + " 14:34", false],
    ["dem00003", new Date().toISOString(), "massage", "decouverte", "Léa Bernard", d(day(1), { time: "22:57", soins: [{ id: "decouverte", people: 2, price: 300 }] }), 600, "Massages & soins", "Confirmée", day(0) + " 20:58", false],
  ];
}

async function signedIn(b) {
  const A = await phone(srv.origin, b);
  await A.ctx.addInitScript((t) => { try { sessionStorage.setItem("vz.admin", t); } catch (e) {} }, b.GOOGLE_TOKEN);
  return A;
}

test("Google session: Demandes lists the real requests (À confirmer 1, Toutes 3)", async () => {
  const b = createBackend({ session: "google", demandes: rows("LEA2611BX") });
  const A = await signedIn(b);
  try {
    await A.page.goto(srv.origin + "/admin/demandes.html");
    await A.page.locator("[data-req-loading]").waitFor({ state: "hidden", timeout: 15000 });
    assert.equal((await A.page.locator("[data-count]").innerText()).trim(), "1");
    await A.page.click("[data-filter='toutes']");
    assert.equal(await A.page.locator("[data-list] .req-row").count(), 3);
    assert.match(await A.page.locator("[data-list]").innerText(), /Confirmée le .* à 20:58/);
    const calls = b.log.filter((e) => e.action === "demandes");
    assert.ok(calls.length >= 1 && calls.every((e) => e.params.token === b.GOOGLE_TOKEN && !e.answer.exception && e.answer.ok), "Google token sent, real answer");
    assert.deepEqual(A.errors, []);
  } finally { await A.ctx.close(); }
});

test("slow script (25 s, like a real admin read): the list still arrives, the read is not re-sent", async () => {
  const b = createBackend({ session: "google", demandes: rows("LEA2611BX") });
  b.fault("demandes", { delay: 25000 });
  const A = await signedIn(b);
  try {
    await A.page.goto(srv.origin + "/admin/demandes.html");
    await A.page.waitForTimeout(10000);
    assert.match(await A.page.locator("[data-req-loading]").innerText(), /met du temps/, "the wait is said, not silent");
    await A.page.locator("[data-req-loading]").waitFor({ state: "hidden", timeout: 30000 });
    assert.equal((await A.page.locator("[data-count]").innerText()).trim(), "1");
    assert.equal(b.log.filter((e) => e.action === "demandes").length, 1, "one demandes call: a slow read is never duplicated");
    assert.equal(await A.page.locator("[data-load-error]:visible").count(), 0);
  } finally { await A.ctx.close(); }
});

test("script exception (Google error page, no CORS): an error with « Réessayer », never an endless « Chargement »", async () => {
  const b = createBackend({ session: "google", demandes: rows("LEA2611BX") });
  // The v19 failure on the production grid (prod-shape.test.js), for any script version.
  b.fault("demandes", { sticky: true, exception: "Exception: The coordinates of the range are outside the dimensions of the sheet." });
  const A = await signedIn(b);
  try {
    await A.page.goto(srv.origin + "/admin/demandes.html");
    await A.page.locator("[data-load-error] [data-retry]").waitFor({ timeout: 15000 });
    assert.equal(await A.page.locator("[data-req-loading]").isVisible(), false);
  } finally { await A.ctx.close(); }
});
