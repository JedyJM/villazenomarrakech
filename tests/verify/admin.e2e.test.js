// FULL ADMIN journey + admin <-> guest link (iPhone 15 WebKit, /exec mocked).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, shot, day, setField, createBackend, browser, waText } = require("./helpers");

let srv, pages, b, A, G;
test.before(async () => {
  srv = await startServer("vercel");
  pages = await startServer("pages");
  b = createBackend();
  A = await phone(srv.origin, b);
  G = await phone(srv.origin, b);
});
test.after(async () => {
  for (const x of [A, G]) if (x) await x.ctx.close();
  if (srv) await srv.close();
  if (pages) await pages.close();
  (await browser()).close();
});

function resRow(id) { return b.stayRow(id); }
function resRows() { return b.box.sheets["Réservations"].rows.slice(1); }

async function fillStay(page, nom) {
  await page.fill("[name='nom']", nom);
  await page.fill("[name='telephone']", "+33 6 00 00 00 99");
  await setField(page, "[name='arrival']", day(3));
  await setField(page, "[name='departure']", day(8));
  await page.click("[data-source='Airbnb']");
  await page.fill("[name='room']", "1000");
}

test("login in test mode → Aujourd'hui", async () => {
  const page = A.page;
  await page.goto(srv.origin + "/admin/index.html");
  await page.click("[data-test]");
  await page.waitForURL(/aujourdhui\.html/);
  await page.locator(".bottom-nav").waitFor();
  assert.equal(await page.locator("[data-gate]").count(), 0);
  // Réglages → « Jeu de test » on: the test stays (origine test) become visible.
  await page.goto(srv.origin + "/admin/reglages.html");
  await page.click("[data-jeu-test]");
  assert.equal(await page.evaluate(() => localStorage.getItem("vz.admin.jeu_test")), "1");
});

test("create a stay: save awaited, label stays « Enregistrer », no navigation before the answer, success shown", async () => {
  const page = A.page;
  await page.goto(srv.origin + "/admin/nouveau.html");
  await fillStay(page, "Marc Petit");
  await page.click("[data-source='Direct']");
  assert.equal((await page.locator("[data-save]").innerText()).trim(), "Enregistrer", "Direct: no « Préparer l’e-mail » label");
  await page.click("[data-source='Airbnb']");
  await page.fill("[name='room']", "1000");
  b.fault("save-stay", { delay: 2000 });
  const before = resRows().length;
  await page.click("[data-save]");
  await page.waitForTimeout(600);
  assert.match(page.url(), /nouveau\.html/, "no navigation while the save is pending");
  assert.equal(await page.locator("[data-save]").isDisabled(), true);
  assert.equal((await page.locator("[data-save]").innerText()).trim(), "Enregistrement…");
  await page.locator(".form-ok").waitFor({ timeout: 10000 });
  assert.match(await page.locator("[data-error]").innerText(), /Séjour enregistré/);
  await shot(page, "admin-stay-saved.png");
  assert.equal(resRows().length, before + 1, "row written once");
  const row = resRows()[resRows().length - 1];
  await page.waitForURL(/sejour\.html\?id=/, { timeout: 10000 });
  assert.ok(row.includes("Marc Petit"));
  assert.ok(row.includes("test"), "origine test");
});

test("save errors are shown (forbidden, network), no navigation, retry works", async () => {
  const page = A.page;
  await page.goto(srv.origin + "/admin/nouveau.html");
  try { await page.evaluate(() => sessionStorage.removeItem("vz.admin.stay.draft")); } catch (e) {}
  await page.goto(srv.origin + "/admin/nouveau.html");
  await fillStay(page, "Nina Roux");
  b.fault("save-stay", { json: { ok: false, error: "forbidden" } });
  await page.click("[data-save]");
  await page.locator("[data-error]", { hasText: "Session expirée" }).waitFor({ timeout: 10000 });
  assert.match(page.url(), /nouveau\.html/);
  assert.equal((await page.locator("[data-save]").innerText()).trim(), "Enregistrer");
  b.fault("save-stay", { abort: true });
  await page.click("[data-save]");
  await page.locator("[data-error]", { hasText: "Pas de réponse" }).waitFor({ timeout: 10000 });
  assert.match(page.url(), /nouveau\.html/);
  await page.click("[data-save]");
  await page.waitForURL(/sejour\.html\?id=/, { timeout: 10000 });
  assert.equal(resRows().filter((r) => r.includes("Nina Roux")).length, 1, "retry reuses the same id");
});

test("edit a stay (Modifier): same id, awaited save", async () => {
  const page = A.page;
  const id = resRows().find((r) => r.includes("Nina Roux"))[0];
  await page.goto(srv.origin + "/admin/sejour.html?id=" + encodeURIComponent(id));
  await page.click("[data-edit-link]");
  await page.waitForURL(/nouveau\.html\?id=/);
  await page.locator("[name='nom']").waitFor();
  assert.equal(await page.locator("[name='nom']").inputValue(), "Nina Roux");
  assert.match(await page.locator("main h1").innerText(), /Modifier/);
  await page.fill("[name='nom']", "Nina Roux-Martin");
  await page.click("[data-save]");
  await page.waitForURL(/sejour\.html\?id=/, { timeout: 10000 });
  const rows = resRows().filter((r) => String(r[0]) === id);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].includes("Nina Roux-Martin"));
});

test("Prolonger / Désactiver: awaited, error shown on failure", async () => {
  const page = A.page;
  const id = b.STAY_ID;
  await page.goto(srv.origin + "/admin/sejour.html?id=" + id);
  await page.locator("[data-prolong]").waitFor();
  b.fault("stay-link", { status: 500 });
  await page.click("[data-prolong]");
  await page.locator("[data-link-error] [data-retry]").waitFor({ timeout: 10000 });
  await page.click("[data-prolong]");
  await page.waitForFunction(() => !document.querySelector("[data-link-error]") || !document.querySelector("[data-link-error]").textContent, null, { timeout: 10000 });
  assert.ok(resRow(id).lien_expire_le, "expiry written");
  await page.locator("[data-stop]").waitFor();
  await page.click("[data-stop]");
  await page.waitForFunction(() => /désactivé/i.test(document.querySelector(".link-until").textContent), null, { timeout: 10000 });
  assert.equal(resRow(id).lien_actif, false);
  // Re-open the link for the next tests.
  await page.click("[data-prolong]");
  await page.waitForFunction(() => /actif/i.test(document.querySelector(".link-until").textContent), null, { timeout: 10000 });
  assert.equal(resRow(id).lien_actif, true);
});

test("LINK: guest demande → provider Confirmer link opened twice → « déjà confirmée »; both sides show the confirmation", async () => {
  const page = G.page;
  await page.goto(srv.origin + "/guest/?stay=" + b.STAY_ID + "&k=" + b.key);
  await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 15000 });
  await page.goto(srv.origin + "/guest/massage.html");
  await page.waitForFunction(() => window.GuestStay.snapshot().state === "ok");
  await page.locator(".care-cat").first().evaluate((d) => { d.open = true; });
  await page.locator(".soin-pick").first().click();
  await setField(page, "[name='date']", day(2));
  await setField(page, "[name='time']", "11:00");
  await page.click("[data-massage-form] button[type='submit']");
  await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
  const link = waText(G.wa[G.wa.length - 1]).match(/\/c\/([0-9a-z]+-[0-9a-z]+)/)[1];
  // Provider phone, GitHub Pages host: /c/<id>-<token> → 404.html → /c/?r=&k=.
  const prov = await phone(pages.origin, b);
  await prov.page.goto(pages.origin + "/c/" + link);
  await prov.page.waitForURL(/\/c\/\?r=/);
  await prov.page.locator("body[data-confirm-state='confirmed']").waitFor({ timeout: 10000 });
  assert.equal(await prov.page.locator("h1").innerText(), "Demande confirmée");
  assert.match(await prov.page.locator("[data-summary]").innerText(), /^Massage · \d+\s\S+ · 11:00$/);
  await prov.page.goto(pages.origin + "/c/" + link);
  await prov.page.locator("body[data-confirm-state='already']").waitFor({ timeout: 10000 });
  assert.equal(await prov.page.locator("h1").innerText(), "Demande déjà confirmée");
  assert.match(await prov.page.locator("[data-note]").innerText(), /^Confirmée le \d+\s\S+ à \d{2}:\d{2}$/);
  assert.equal(prov.page.url().startsWith(pages.origin), true, "stays on our domain (no Google page)");
  await shot(prov.page, "deja-confirmee.png");
  await prov.ctx.close();
  // Guest side.
  await page.goto(srv.origin + "/guest/demandes.html");
  const card = page.locator("[data-demand-list] li", { hasText: "Massage" }).first();
  await card.waitFor({ timeout: 15000 });
  assert.match(await card.innerText(), /Confirmée[\s\S]*Confirmée le \d+\s\S+ à \d{2}:\d{2}/);
  // Admin side.
  await A.page.goto(srv.origin + "/admin/demandes.html");
  await A.page.click("[data-filter='toutes']");
  const row = A.page.locator("[data-list] [data-id]", { hasText: "Massage" }).first();
  await row.waitFor({ timeout: 15000 });
  const text = await row.innerText();
  assert.match(text, /Confirmée/i);
  assert.match(text, /Léa Bernard/);
  assert.match(text, /11:00/);
  assert.match(text, /Confirmée le \d+\s\S+ à \d{2}:\d{2}/);
});

test("Demandes (admin): status change awaited and written; failure reverts with an error", async () => {
  const page = A.page;
  // A fresh guest demande (ménage) to confirm from the admin.
  const body = { stay: b.STAY_ID, k: b.key, id: "adm1", token: "tokadm1", service: "menage", sous_type: "maison", nom_client: "Invité", destinataire: "Nadera", details: { booking_id: b.STAY_ID, token: "tokadm1", scope: "maison", date: day(2), time: "10:00" } };
  b.box.ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  await page.goto(srv.origin + "/admin/demandes.html?open=adm1");
  await page.click("[data-filter='toutes']");
  await page.click("[data-open='adm1']");
  b.fault("set-demande", { abort: true });
  await page.click("[data-statut='adm1']");
  await page.click("[data-set='Confirmée']");
  await page.locator("[data-req-error] [data-retry]").waitFor({ timeout: 10000 });
  assert.equal(b.demandes().find((d) => d.id === "adm1").statut, "Envoyée", "not written");
  assert.match(await page.locator("[data-id='adm1']").innerText(), /Envoyée/i, "reverted on screen");
  await page.click("[data-req-error] [data-retry]");
  await page.waitForFunction(() => /Confirmée/i.test(document.querySelector("[data-id='adm1']").textContent), null, { timeout: 10000 });
  const d = b.demandes().find((x) => x.id === "adm1");
  assert.equal(d.statut, "Confirmée");
  assert.match(String(d.date_confirmation), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.match(await page.locator("[data-id='adm1']").innerText(), /Léa Bernard/);
  assert.doesNotMatch(await page.locator("[data-list]").innerText(), /00:00/);
});

test("LINK: Encaisser marked paid in admin → guest Récapitulatif shows it settled", async () => {
  const page = A.page;
  await page.goto(srv.origin + "/admin/encaissement.html?sejour=" + b.STAY_ID);
  await page.locator("[data-pay]").waitFor({ timeout: 15000 });
  await page.click("[data-pay]");
  await page.click("[data-pay-confirm]");
  await page.locator("[data-pay-sheet]").waitFor({ state: "hidden", timeout: 10000 });
  const row = resRow(b.STAY_ID);
  assert.ok(row.encaisse_le, "encaisse_le written");
  assert.ok(row.encaisse_mode);
  const g = G.page;
  await g.goto(srv.origin + "/guest/recap.html");
  await g.locator("[data-settled]:not([hidden])").waitFor({ timeout: 15000 });
  assert.match(await g.locator("[data-settled]").innerText(), /Réglé à la villa[\s\S]*Réglé le/);
  // Settled: the detail stays visible (pool heating 3 × 60 € = 180 €), « Total réglé », rate; no payment buttons.
  const bill = await g.locator("[data-bill-card]").innerText();
  assert.match(bill, /À RÉGLER À LA VILLA[\s\S]*Chauffage piscine[\s\S]*180\s€[\s\S]*Total réglé[\s\S]*180\s€/);
  assert.equal(await g.locator(".pay-choice").isHidden(), true, "no payment buttons once settled");
  assert.match(await g.locator(".recap-rate").innerText(), /1\s€ = 10\sMAD/); // audit 28/11 point 8
  assert.match(await g.locator("[data-settled]").innerText(), /180\s€/);
  await shot(g, "recap-after-encaissement.png");
});

test("Stats and Aujourd'hui load from the real feeds without error", async () => {
  const page = A.page;
  await page.goto(srv.origin + "/admin/stats.html");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("[data-load-error]:not([hidden])").count(), 0);
  assert.ok((await page.locator("[data-stats]").innerText()).length > 20);
  await page.goto(srv.origin + "/admin/aujourdhui.html");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("[data-load-error]:not([hidden])").count(), 0);
  assert.equal(A.errors.length, 0, "no JS error: " + A.errors.join(" | "));
});
