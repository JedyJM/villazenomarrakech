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

const { setField, day, waText } = require("./helpers");

async function fillAirport(page) {
  await setField(page, "[data-transfer-form] [name='date']", day(2));
  await setField(page, "[data-transfer-form] [name='time']", "15:30");
  await page.fill("[name='flight_number']", "AT800");
  await page.fill("[name='origin_city']", "Paris");
}

test("audit 28/11 point 2: baby seat is a direct counter from 0 (no switch); payload, WhatsApp and price unchanged (+50 MAD per seat)", async () => {
  const b = createBackend();
  const P = await phone(srv.origin, b);
  const page = P.page;
  const last = () => b.demandes()[b.demandes().length - 1];
  try {
    await openTransfer(P, b, b.STAY_ID);
    const form = "[data-transfer-form]";
    assert.equal(await page.locator(form + " [name='baby_seat']").count(), 0, "no switch");
    assert.equal(await page.locator(form + " .baby-row .switch").count(), 0, "no switch");
    assert.ok(await page.locator("[data-baby-step]").isVisible(), "counter shown at once");
    assert.equal(await page.textContent("[data-baby-count]"), "0");
    assert.ok(await page.locator('[data-step="baby"][data-dir="-1"]').isDisabled(), "cannot go under 0");
    // 0 = none: 2 passengers -> 350, no supplement.
    await fillAirport(page);
    assert.doesNotMatch(await page.textContent("[data-price-break]"), /siège/);
    await page.click("[data-transfer-submit]");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
    let row = last();
    assert.equal(row.details.baby_seat, false);
    assert.equal(row.details.baby_seats, 0);
    assert.equal(Number(row.total_dh), 350);
    assert.match(waText(P.wa[P.wa.length - 1]), /Sièges bébé : Aucun/);
    assert.match(await page.textContent("[data-confirm-list]"), /Sièges bébé\s*0/);
    // Counter: + + + + stops at 3, − back to 2 -> 2 × 50 = 100.
    await openTransfer(P, b, b.STAY_ID);
    const plus = page.locator('[data-step="baby"][data-dir="1"]');
    for (let i = 0; i < 4; i++) if (await plus.isEnabled()) await plus.click();
    assert.equal(await page.textContent("[data-baby-count]"), "3");
    assert.ok(await plus.isDisabled(), "3 max");
    await page.click('[data-step="baby"][data-dir="-1"]');
    assert.equal(await page.textContent("[data-baby-count]"), "2");
    assert.match(await page.textContent("[data-price-total]"), /Total 450/);
    assert.match(await page.textContent("[data-price-break]"), /2 sièges bébé 100/);
    await shot(page, "audit-p2-baby-2.png");
    await fillAirport(page);
    await page.click("[data-transfer-submit]");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
    row = last();
    assert.equal(row.details.baby_seat, true, "v21 field kept");
    assert.equal(row.details.baby_seats, 2);
    assert.equal(Number(row.total_dh), 450);
    assert.match(row.details.resume, /Sièges bébé : 2/);
    assert.match(waText(P.wa[P.wa.length - 1]), /Sièges bébé : 2/);
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});

test("audit 28/11 point 2: the English page (untouched, switch) still sends its seats", async () => {
  const b = createBackend();
  const P = await phone(srv.origin, b);
  const page = P.page;
  try {
    await page.goto(srv.origin + "/guest/en/transfer.html?stay=" + b.STAY_ID + "&k=" + b.key);
    await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
    assert.ok(await page.locator("[data-baby-step]").isHidden());
    await page.locator(".baby-row .switch").click();
    assert.equal(await page.textContent("[data-baby-count]"), "1");
    assert.ok(await page.locator('[data-step="baby"][data-dir="-1"]').isDisabled());
    await page.click('[data-step="baby"][data-dir="1"]');
    assert.equal(await page.textContent("[data-baby-count]"), "2");
    await fillAirport(page);
    await page.click("[data-transfer-submit]");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
    const row = b.demandes()[b.demandes().length - 1];
    assert.equal(row.details.baby_seats, 2);
    assert.equal(Number(row.total_dh), 450);
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});

test("audit 28/11 point 8: MAD on services (screen, WhatsApp), récap in € with the MAD equivalent, meals still in €", async () => {
  const b = createBackend();
  const P = await phone(srv.origin, b);
  const page = P.page;
  try {
    // Transfer: 2 passengers + 1 seat.
    await openTransfer(P, b, b.STAY_ID);
    await page.click('[data-step="baby"][data-dir="1"]');
    assert.equal(await page.textContent("[data-price-total]"), "Total 400 MAD");
    assert.equal(await page.textContent("[data-price-break]"), "1 véhicule · 1–4 pers. 350 MAD + 1 siège bébé 50 MAD");
    await fillAirport(page);
    await page.click("[data-transfer-submit]");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
    assert.match(waText(P.wa[P.wa.length - 1]), /Total : 400 MAD/);
    assert.match(await page.textContent("[data-confirm-list]"), /Total\s*400 MAD/);
    assert.doesNotMatch(await page.textContent("main"), /\bDH\b/);
    // Massages: listed and total in MAD.
    await page.goto(srv.origin + "/guest/massage.html");
    await page.click("[data-soin='decouverte'] .soin-pick");
    assert.match(await page.textContent("[data-soin='decouverte']"), /300 MAD/);
    assert.match(await page.textContent("[data-massage-form] [data-price-total]"), /Total 300 MAD/);
    // Experiences.
    await page.goto(srv.origin + "/guest/activites.html");
    await page.locator("input[name='activity'][value='quad']").check({ force: true });
    await page.click('[data-count="quad1"][data-dir="1"]');
    assert.match(await page.textContent("[data-activity-form] [data-price-total]"), /Total 300 MAD/);
    assert.doesNotMatch(await page.textContent("main"), /\bDH\b/);
    // Meals unchanged: euros.
    await page.goto(srv.origin + "/guest/restauration.html");
    assert.match(await page.textContent("main"), /€/);
    assert.doesNotMatch(await page.textContent("main"), /\bMAD\b|\bDH\b/);
    // Récap: € amounts, « soit … MAD », rate in MAD (pool heating 3 × 60 € = 180 €).
    await page.goto(srv.origin + "/guest/recap.html");
    await page.locator("[data-bill] .recap-sum").waitFor({ timeout: 15000 });
    const bill = await page.textContent("[data-bill]");
    assert.match(bill, /180 €/);
    assert.match(bill, /soit 1 800 MAD/);
    assert.equal(await page.textContent(".recap-rate"), "Taux appliqué : 1 € = 10 MAD");
    assert.doesNotMatch(await page.textContent("main"), /\bDH\b/);
    await shot(page, "audit-p8-recap.png");
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});

test("audit 28/11 point 6: spa brochure viewer (swipe/arrows, « Fermer », Escape, back) keeps the current selection", async () => {
  const b = createBackend();
  const P = await phone(srv.origin, b);
  const page = P.page;
  const fetched = [];
  page.on("request", (r) => { if (/brochure-spa-\d\.webp/.test(r.url())) fetched.push(r.url()); });
  try {
    await page.goto(srv.origin + "/guest/massage.html?stay=" + b.STAY_ID + "&k=" + b.key);
    await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
    // A selection in progress: Massage découverte × 2, a date, a note.
    await page.click("[data-soin='decouverte'] .soin-pick");
    await page.click("[data-soin='decouverte'] [data-soin-step='1']");
    await setField(page, "[data-massage-form] [name='date']", day(3));
    await page.click("[data-massage-form] [data-comment-toggle]");
    await page.fill("[data-massage-form] [name='comment']", "Huile ambre");
    const selection = async () => ({
      picked: await page.getAttribute("[data-soin='decouverte'] .soin-pick", "aria-pressed"),
      count: await page.textContent("[data-soin='decouverte'] [data-soin-count]"),
      date: await page.inputValue("[data-massage-form] [name='date']"),
      note: await page.inputValue("[data-massage-form] [name='comment']"),
      total: await page.textContent("[data-massage-form] [data-price-total]"),
      url: page.url(),
    });
    const before = await selection();
    assert.deepEqual([before.picked, before.count, before.total], ["true", "2", "Total 600 MAD"]);
    assert.equal(fetched.length, 0, "no brochure image with the page");
    const dialog = page.locator("[data-brochure]");
    // Open: full screen, 4 pages with French alt, page 1 of 4.
    await page.click("[data-brochure-open]");
    await dialog.waitFor({ state: "visible" });
    const box = await dialog.boundingBox();
    const vp = page.viewportSize();
    assert.ok(box.width >= vp.width - 1 && box.height >= vp.height - 1, "full screen");
    const alts = await page.locator("[data-brochure] img").evaluateAll((els) => els.map((e) => e.alt));
    assert.equal(alts.length, 4);
    alts.forEach((alt, i) => assert.match(alt, new RegExp("^Brochure du spa, page " + (i + 1) + " sur 4 : ")));
    await page.waitForFunction(() => [...document.querySelectorAll("[data-brochure] img")].every((i) => i.complete && i.naturalWidth === 1400));
    assert.equal(new Set(fetched).size, 4, "loaded on open");
    assert.equal(await page.textContent("[data-brochure-live]"), "Page 1 sur 4");
    assert.ok(await page.locator('[data-brochure-go="-1"]').isDisabled());
    assert.match(page.url(), /#brochure$/);
    // Arrows, then a swipe (horizontal scroll) to the last page.
    await page.click('[data-brochure-go="1"]');
    await page.waitForFunction(() => document.querySelector("[data-brochure-live]").textContent === "Page 2 sur 4");
    await page.locator("[data-brochure-pages]").evaluate((el) => { el.scrollTo({ left: el.scrollWidth, behavior: "instant" }); });
    await page.waitForFunction(() => document.querySelector("[data-brochure-live]").textContent === "Page 4 sur 4");
    assert.ok(await page.locator('[data-brochure-go="1"]').isDisabled());
    await shot(page, "audit-p6-viewer.png");
    // « Fermer »: closed, same page, selection untouched.
    await page.click("[data-brochure-close]");
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(await selection(), before);
    // Back gesture / button: closes the viewer, does not leave the page.
    await page.click("[data-brochure-open]");
    await dialog.waitFor({ state: "visible" });
    await page.goBack();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(await selection(), before);
    // Escape.
    await page.click("[data-brochure-open]");
    await dialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(await selection(), before);
    // No history left behind: one back now leaves the page as before.
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("is-brochure")), false);
    // The request still goes out with the selection.
    await setField(page, "[data-massage-form] [name='time']", "17:00");
    await page.click("[data-massage-form] [type='submit']");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
    assert.equal(Number(b.demandes()[b.demandes().length - 1].total_dh), 600);
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});
