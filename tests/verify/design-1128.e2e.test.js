// Nouveau design invité 2026-11-28 — parcours WebKit (iPhone 16 390×844 et SE 375×667), sans réseau.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { devices } = require("playwright");
const { startServer, browser } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { await srv.close(); (await browser()).close(); });

async function open(w, h, url) {
  const b = await browser();
  const ctx = await b.newContext(Object.assign({}, devices["iPhone 15"], { viewport: { width: w, height: h }, screen: { width: w, height: h }, locale: "fr-FR" }));
  await ctx.route("**/*", (r) => (r.request().url().startsWith(srv.origin) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(srv.origin + url);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

for (const [name, w, h] of [["iPhone 16", 390, 844], ["iPhone SE", 375, 667]]) {
  test("La Villa v2h " + name + " : liste sans défilement, accordéon, texte au-dessus de la barre, Contacts", async () => {
    const { ctx, page, errors } = await open(w, h, "/guest/villa.html");
    const base = await page.evaluate(() => {
      const s = document.querySelector(".screen");
      return { scroll: s.scrollHeight - s.clientHeight, x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        nav: [...document.querySelectorAll(".app > .nav a, .app > .nav button")].map((a) => a.textContent.trim()) };
    });
    assert.equal(base.scroll, 0, "liste fermée sans défilement");
    assert.equal(base.x, 0, "pas de débordement horizontal");
    assert.deepEqual(base.nav, ["Accueil", "Demandes", "Accès", "Contacts", "Mehdi"]);
    for (const id of ["bienvenue", "equipe", "services", "repas", "famille", "quotidien", "cles", "visiteurs", "vie", "depart"]) {
      await page.click(`details[data-sec="${id}"] summary`);
      await page.waitForTimeout(150);
      const m = await page.evaluate((id) => {
        const el = document.querySelector(`details[data-sec="${id}"]`);
        const last = el.querySelector(".guide-body").lastElementChild;
        const nav = document.querySelector(".nav").getBoundingClientRect();
        const st = document.querySelector(".stick").getBoundingClientRect();
        const sum = el.querySelector("summary").getBoundingClientRect();
        return { open: [...document.querySelectorAll(".guide-list details[open]")].map((d) => d.dataset.sec),
          under: Math.max(0, Math.round(last.getBoundingClientRect().bottom - nav.top)), covered: Math.max(0, Math.round(st.bottom - sum.top - 0.5)) };
      }, id);
      assert.deepEqual(m.open, [id], id + " : une seule section ouverte");
      assert.equal(m.under, 0, id + " : texte sous la barre");
      assert.equal(m.covered, 0, id + " : titre couvert par l'en-tête");
    }
    const lines = await page.evaluate(() => [...document.querySelectorAll('details[data-sec="depart"] .depart-line, details[data-sec="depart"] .checks span')].map((p) => {
      const r = document.createRange(); r.selectNodeContents(p); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; }));
    assert.deepEqual(lines, [2, 1, 4, 1, 1, 1, 1], "coupures de Votre départ");
    await page.click(".nav [data-open-contacts]");
    await page.locator("#contacts-dialog[open]").waitFor({ timeout: 5000 });
    assert.ok(await page.locator("#contacts-dialog", { hasText: "Hicham" }).isVisible());
    await page.click("[data-contacts-close]");
    assert.equal(await page.locator(".nav [data-guest-whatsapp]").getAttribute("aria-label"), "Écrire à Mehdi, votre hôte, sur WhatsApp");
    assert.match(await page.locator(".nav [data-guest-whatsapp]").getAttribute("href"), /^https:\/\/wa\.me\/\d+\?text=/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}
