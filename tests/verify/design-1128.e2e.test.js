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

for (const [name, w, h] of [["iPhone 16", 390, 844], ["iPhone SE", 375, 667]]) {
  test("Wi-Fi & TV v3c " + name + " : un écran, rien sous la barre, corps TV = corps Bose, vrai QR local", async () => {
    const { ctx, page, errors } = await open(w, h, "/guest/wifi.html");
    const m = await page.evaluate(() => {
      const s = document.querySelector(".screen"), nav = document.querySelector(".nav").getBoundingClientRect();
      let under = 0;
      document.querySelectorAll(".screen *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height) under = Math.max(under, Math.round(r.bottom - nav.top)); });
      const ty = (sel) => { const c = getComputedStyle(document.querySelector(sel)); return [c.fontFamily, c.fontSize, c.lineHeight, c.fontStyle, c.fontWeight, c.color].join("|"); };
      const one = [...document.querySelectorAll("h1, h2, .lead, .val")].filter((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1; }).map((e) => e.textContent);
      const path = document.querySelector("[data-wifi-qr-svg] svg path");
      return { scroll: s.scrollHeight - s.clientHeight, under: Math.max(0, under), x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bose: ty(".wf-bose p:not(.soft)"), tv: ty(".wf-tv p"), one, net: document.querySelector("[data-wifi-network]").textContent,
        pass: document.querySelector("[data-wifi-password]").textContent, qr: path ? path.getAttribute("d") : "", qrBox: document.querySelector(".qr-box").getBoundingClientRect().width };
    });
    assert.equal(m.scroll, 0, "aucun défilement");
    assert.equal(m.under, 0, "rien sous la barre");
    assert.equal(m.x, 0);
    assert.equal(m.tv, m.bose, "corps Télévision = corps Bose");
    assert.match(m.bose, /^DM Sans.*\|normal\|400\|rgb\(35, 31, 27\)$/);
    assert.deepEqual(m.one, [], "titres et valeurs sur une ligne");
    const cfg = require("../../guest/js/wifi-config.js");
    assert.equal(m.net, cfg.wifi.network);
    assert.equal(m.pass, cfg.wifi.password);
    assert.equal(m.qrBox, h >= 780 ? 116 : 92, "carré QR");
    const qrcode = require("../../guest/js/qrcode.js");
    const qr = qrcode(0, "M"); qr.addData(cfg.wifiPayload()); qr.make();
    let d = ""; const n = qr.getModuleCount();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + 1) + " " + (r + 1) + "h1v1h-1z";
    assert.equal(m.qr, d, "QR = matrice qrcode.js de wifi-config.js");
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}
