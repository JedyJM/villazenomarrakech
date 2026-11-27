// FULL GUEST journey on iPhone 15 WebKit, /exec mocked (backend.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, waText, shot, day, setField, createBackend, browser } = require("./helpers");

let srv, b, P;
const TOMORROW = day(1);
const D2 = day(2);

test.before(async () => {
  srv = await startServer("vercel");
  b = createBackend();
  P = await phone(srv.origin, b);
});
test.after(async () => {
  if (P) await P.ctx.close();
  if (srv) await srv.close();
  (await browser()).close();
});

async function stayReady(page) {
  await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 15000 });
}
async function sentOk(page) {
  await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
}
function lastWa() { return waText(P.wa[P.wa.length - 1] || "https://wa.me/x?text="); }
function lastRow() { const all = b.demandes(); return all[all.length - 1]; }

test("private link: /guest/?stay=&k= → home with the real name and stay dates", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/?stay=" + b.STAY_ID + "&k=" + b.key);
  await stayReady(page);
  await page.locator(".stay-card[data-stay-ready]").waitFor();
  const title = await page.locator(".stay-card h1").innerText();
  assert.match(title, /Marhaba Léa,/);
  assert.doesNotMatch(title, /Invité/);
  assert.equal(await page.locator(".mini-example").count(), 0, "no Exemple badge");
  const dates = await page.locator(".stay-range time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")));
  assert.deepEqual(dates, [b.addDays(-1), b.addDays(7)]);
  await shot(page, "guest-home.png");
});

test("restauration: breakfast before 9h = +10 € (100 DH) per table, real name in the Sheet", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/restauration.html");
  await stayReady(page);
  await page.click("[data-meal='breakfast']");
  await setField(page, "[name='date']", TOMORROW);
  await page.selectOption("[name='time']", "08:00");
  // Guests prefilled from the booking (2 adults), « Modifier » → 3 adults.
  await page.locator("[data-guests-summary]:not([hidden])").waitFor();
  assert.match(await page.locator("[data-guests-text]").innerText(), /2 adultes/);
  await page.click("[data-guests-edit]");
  await page.click("[data-people-kind='adults'][data-dir='1']");
  await page.click("[data-bf-tab='oeufs']");
  await page.click("[data-egg='dur'][data-dir='1']");
  await page.click("[data-meal-form] button[type='submit']");
  await sentOk(page);
  const rows = await page.locator("[data-confirm-list]").innerText();
  assert.match(rows, /Supplément[\s\S]*10\s€/);
  assert.match(rows, /Total[\s\S]*3 personnes · 40\s€/, "3 × 10 € + 10 € per table");
  const row = lastRow();
  assert.equal(row.service, "restauration");
  assert.equal(row.nom_client, "Léa Bernard");
  assert.equal(row.details.supplement_dh, 10);
  assert.equal(row.details.time, "08:00");
  assert.doesNotMatch(row.details.resume, /€|DH/, "staff summary has no price");
});

test("ménage, piscine, activités: posted, awaited, real name", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/menage.html");
  await stayReady(page);
  await setField(page, "[name='date']", TOMORROW);
  await setField(page, "[name='time']", "10:00");
  await page.click("[data-menage-form] button[type='submit']");
  await sentOk(page);
  assert.equal(lastRow().service, "menage");
  assert.equal(lastRow().nom_client, "Léa Bernard");

  await page.goto(srv.origin + "/guest/piscine.html");
  await stayReady(page);
  await page.click("[data-clean='piscine']");
  await setField(page, "[name='date']", TOMORROW);
  await setField(page, "[name='time']", "09:30");
  await page.click("[data-pool-form] button[type='submit']");
  await sentOk(page);
  assert.equal(lastRow().service, "piscine");

  await page.goto(srv.origin + "/guest/activites.html");
  await stayReady(page);
  await page.locator("input[name='activity'][value='quad']").check({ force: true });
  await page.click("[data-count='quad1'][data-dir='1']");
  await setField(page, "[name='date']", D2);
  await setField(page, "[name='time']", "14:30");
  await page.click("[data-activity-form] button[type='submit']");
  await sentOk(page);
  assert.equal(lastRow().service, "activites");
  assert.equal(lastRow().nom_client, "Léa Bernard");
});

test("transfert aéroport: guest WhatsApp with the real name, the time and the Confirmer link", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/transfert.html");
  await stayReady(page);
  await setField(page, "[data-transfer-form] [name='date']", D2);
  await setField(page, "[data-transfer-form] [name='time']", "15:30");
  await page.fill("[name='flight_number']", "AT800");
  await page.fill("[name='origin_city']", "Paris");
  await page.click("[data-transfer-submit]");
  await sentOk(page);
  const text = lastWa();
  assert.match(text, /Nom : Léa Bernard/);
  assert.doesNotMatch(text, /Invité/);
  assert.match(text, /Heure d’arrivée du vol : 15:30/);
  const row = lastRow();
  assert.equal(row.service, "transfert");
  assert.ok(text.includes(srv.origin + "/c/" + row.id + "-" + row.details.token), "compact Confirmer link");
  // The generated text rendered on a page (evidence).
  const view = await P.ctx.newPage();
  await view.setContent("<meta name=viewport content='width=device-width'><body style='font:16px -apple-system,sans-serif;padding:16px;background:#e7ffdb'><p style='color:#555'>Texte WhatsApp généré (transfert aéroport)</p><pre style='white-space:pre-wrap;background:#fff;padding:12px;border-radius:10px'></pre></body>");
  await view.locator("pre").evaluate((el, t) => { el.textContent = t; }, text);
  await shot(view, "wa-text-real-name.png");
  await view.close();
});

test("transfert ville, location, massage: real name, times, Confirmer link", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/transfert.html");
  await stayReady(page);
  await page.click("[data-show='city']");
  await setField(page, "#city-date", D2);
  await setField(page, "#city-time", "11:00");
  await page.fill("#city-destination", "Gueliz");
  await page.click("[data-city-form] button[type='submit']");
  await sentOk(page);
  let text = lastWa();
  assert.match(text, /Nom : Léa Bernard/);
  assert.match(text, /Heure de prise en charge : 11:00/);
  assert.equal(lastRow().service, "course");

  await page.goto(srv.origin + "/guest/transfert.html");
  await stayReady(page);
  await page.click("[data-show='rental']");
  await setField(page, "#start", TOMORROW);
  await setField(page, "#start-time", "10:00");
  await setField(page, "#end", D2);
  await setField(page, "#end-time", "10:00");
  for (const [n, v] of [["car_type", "citadine"], ["delivery", "villa"], ["usage", "marrakech"]]) await page.locator(`input[name='${n}'][value='${v}']`).check({ force: true });
  await page.click("[data-rental-form] button[type='submit']");
  await sentOk(page);
  text = lastWa();
  assert.match(text, /Nom : Léa Bernard/);
  assert.match(text, /à 10:00/);
  assert.equal(lastRow().service, "location_voiture");

  await page.goto(srv.origin + "/guest/massage.html");
  await stayReady(page);
  await page.locator(".care-cat").first().evaluate((d) => { d.open = true; });
  await page.locator(".soin-pick").first().click();
  await setField(page, "[name='date']", D2);
  await setField(page, "[name='time']", "11:00");
  await page.click("[data-massage-form] button[type='submit']");
  await sentOk(page);
  text = lastWa();
  assert.match(text, /Nom : Léa Bernard/);
  assert.match(text, /Heure : 11:00/);
  assert.match(text, /\/c\/[0-9a-z]+-[0-9a-z]+/);
  assert.equal(lastRow().service, "massage");
  P.wa.forEach((u) => assert.doesNotMatch(waText(u), /Invité/, "no « Invité » in any WhatsApp text"));
});

test("Mes demandes: the 8 demandes, real times (never 00:00), stable over 3 reloads", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/demandes.html");
  for (let i = 1; i <= 3; i++) {
    if (i > 1) await page.reload();
    await page.locator("[data-demand-list] li").first().waitFor({ timeout: 15000 });
    const n = await page.locator("[data-demand-list] li").count();
    assert.equal(n, 8, "reload " + i);
    const text = await page.locator("[data-demand-list]").innerText();
    assert.doesNotMatch(text, /00:00/);
    assert.match(text, /15:30/);
    assert.match(text, /Location de voiture[\s\S]*10:00/);
    assert.ok(await page.locator("[data-stay-dates]").innerText(), "stay dates shown");
    await shot(page, "mes-demandes-reload-" + i + ".png");
  }
});

test("Accès villa, Contacts utiles (Mehdi with his number), Récapitulatif", async () => {
  const page = P.page;
  await page.goto(srv.origin + "/guest/acces.html");
  assert.match(await page.locator("main").innerText(), /Itinéraire 1/);
  assert.ok(await page.locator("a[href*='google.com/maps']").count() >= 1);
  await page.click("[data-open-contacts]");
  const sheet = page.locator("#contacts-dialog");
  await sheet.waitFor({ state: "visible" });
  const txt = await sheet.innerText();
  assert.match(txt, /Mehdi/);
  assert.match(txt.replace(/\s/g, ""), /\+212661147610/);
  await page.goto(srv.origin + "/guest/recap.html");
  await page.locator("[data-bill] .recap-sum").waitFor({ timeout: 15000 });
  assert.match(await page.locator("[data-bill]").innerText(), /Chauffage piscine/);
  assert.equal(P.errors.length, 0, "no JS error: " + P.errors.join(" | "));
});
