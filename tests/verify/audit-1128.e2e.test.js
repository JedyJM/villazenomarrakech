// Audit design 2026-11-28 in the browser (iPhone 15 WebKit, local server,
// /exec mocked by the real script logic). Fictitious stays only.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, shot, createBackend, browser } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

// Positional rows of the legacy Réservations shape (backend RES_HEADERS).
function stayRow(b, id, adults, kids) {
  return [id, "Famille Test", "+33600000009", b.addDays(-1), b.addDays(6), "Airbnb", adults, kids, "Villa Zen'O", "test", true, "", 0, 0, false, "", "", "", ""];
}
function backendWith(stays) {
  const b0 = createBackend();
  return createBackend({ stays: stays.map(([id, a, k]) => stayRow(b0, id, a, k)) });
}
async function openTransfer(P, b, id, hash) {
  const q = id ? "?stay=" + id + "&k=" + b.keyOf(id) : "";
  await P.page.goto(srv.origin + "/guest/transfert.html" + q + (hash || ""));
  if (id) await P.page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
}
const val = (page, form, name) => page.locator(form + " [name='" + name + "']").inputValue();

test("audit 28/11 point 1: Aéroport and En ville travellers prefilled from the stay (adults + children), still editable", async () => {
  const b = backendWith([["FAM2811AA", 2, 2], ["GRP2811BB", 6, 4]]);
  const P = await phone(srv.origin, b);
  const page = P.page;
  try {
    // 2 adults + 2 children -> 4 passengers, 1 vehicle; 4 people in town.
    await openTransfer(P, b, "FAM2811AA");
    await page.locator("[data-transfer-form][data-prefilled='4']").waitFor({ timeout: 5000 });
    assert.equal(await val(page, "[data-transfer-form]", "passengers"), "4");
    assert.equal(await val(page, "[data-transfer-form]", "vehicles"), "1");
    assert.equal(await page.textContent("[data-passengers-count]"), "4");
    assert.equal(await val(page, "[data-city-form]", "passengers"), "4");
    await shot(page, "audit-p1-transfert-prefill.png");
    // Editable, and a later stay refresh does not overwrite the guest's choice.
    await page.click('[data-step="passengers"][data-dir="1"]');
    assert.equal(await page.textContent("[data-passengers-count]"), "5");
    await page.evaluate(() => window.GuestStay.load({ force: true }));
    await page.waitForTimeout(800);
    assert.equal(await page.textContent("[data-passengers-count]"), "5", "guest choice kept");
    await page.click("[data-show='city']");
    await page.click('[data-city-step="-1"]');
    assert.equal(await page.textContent("[data-city-count]"), "3");
    // 10 travellers -> 2 vehicles, 10 passengers; town capped at 8.
    await openTransfer(P, b, "GRP2811BB");
    await page.locator("[data-transfer-form][data-prefilled='10']").waitFor({ timeout: 5000 });
    assert.equal(await val(page, "[data-transfer-form]", "vehicles"), "2");
    assert.equal(await val(page, "[data-transfer-form]", "passengers"), "10");
    assert.equal(await val(page, "[data-city-form]", "passengers"), "8");
    // Journey stay (2 adults, no child) -> 2.
    await openTransfer(P, b, b.STAY_ID);
    await page.locator("[data-transfer-form][data-prefilled='2']").waitFor({ timeout: 5000 });
    assert.equal(await val(page, "[data-city-form]", "passengers"), "2");
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
  // No known stay: the page defaults (3 passengers, 1 person in town).
  const Q = await phone(srv.origin, b);
  try {
    await openTransfer(Q, b, "");
    await Q.page.waitForTimeout(500);
    assert.equal(await val(Q.page, "[data-transfer-form]", "passengers"), "3");
    assert.equal(await val(Q.page, "[data-city-form]", "passengers"), "1");
    assert.equal(await Q.page.locator("[data-transfer-form][data-prefilled]").count(), 0);
  } finally { await Q.ctx.close(); }
});
