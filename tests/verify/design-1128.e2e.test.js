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

for (const [name, w, h, size, lines] of [["iPhone 16", 390, 844, "171.0x165.5", [3, 3, 3, 3, 3, 3, 3, 2]], ["iPhone SE", 375, 667, "164.5x123.1", [3, 3, 3, 2, 3, 3, 3, 2]]]) {
  test("Loisirs v3d " + name + " : un écran, huit cartes égales, corps ≤ 3 lignes, clôture en DM Sans taupe", async () => {
    const { ctx, page, errors } = await open(w, h, "/guest/loisirs.html");
    const m = await page.evaluate(() => {
      const s = document.querySelector(".screen"), nav = document.querySelector(".nav").getBoundingClientRect();
      let under = 0;
      document.querySelectorAll(".screen *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height) under = Math.max(under, Math.round(r.bottom - nav.top)); });
      const ty = (e) => { const c = getComputedStyle(e); return [c.fontFamily, c.fontSize, c.fontStyle, c.color].join("|"); };
      return { scroll: s.scrollHeight - s.clientHeight, under: Math.max(0, under), x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sizes: [...new Set([...document.querySelectorAll(".tile")].map((t) => { const r = t.getBoundingClientRect(); return r.width.toFixed(1) + "x" + r.height.toFixed(1); }))],
        lines: [...document.querySelectorAll(".tile p")].map((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; }),
        clipped: [...document.querySelectorAll(".tile")].filter((t) => t.scrollHeight > t.clientHeight + 1).length,
        h2: [...document.querySelectorAll(".screen h1, .screen h2, .screen .lead")].filter((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size !== 1; }).map((e) => e.textContent),
        body: ty(document.querySelector(".tile p")), close: ty(document.querySelector(".tile.close p")) };
    });
    assert.equal(m.scroll, 0); assert.equal(m.under, 0); assert.equal(m.x, 0);
    assert.deepEqual(m.sizes, [size], "huit cartes égales");
    assert.deepEqual(m.lines, lines, "lignes par carte (maquette)");
    assert.equal(m.clipped, 0, "aucune carte rognée");
    assert.deepEqual(m.h2, [], "titres sur une ligne");
    assert.equal(m.close, m.body, "clôture = corps des cartes");
    assert.match(m.body, /^DM Sans.*\|normal\|rgb\(115, 104, 93\)$/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

for (const [name, w, h, row] of [["iPhone 16", 390, 844, 74], ["iPhone SE", 375, 667, 56]]) {
  test("Nos adresses v3b " + name + " : fermé sans défilement, une section à la fois, rien sous le bouton, chauffeur → En ville", async () => {
    const { ctx, page, errors } = await open(w, h, "/guest/marrakech.html");
    const measure = () => page.evaluate(() => {
      const s = document.querySelector(".screen"), sr = s.getBoundingClientRect(), a = document.querySelector(".action").getBoundingClientRect();
      let under = 0;
      document.querySelectorAll(".screen *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height && r.top < sr.bottom && r.bottom > sr.top) under = Math.max(under, Math.round(Math.min(r.bottom, sr.bottom) - a.top)); });
      return { scroll: s.scrollHeight - s.clientHeight, under: Math.max(0, under), x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rows: [...new Set([...document.querySelectorAll(".acc-btn")].map((b) => Math.round(b.getBoundingClientRect().height)))],
        open: [...document.querySelectorAll(".acc-btn[aria-expanded=true]")].map((b) => b.id), shown: [...document.querySelectorAll(".panel:not([hidden])")].map((p) => p.id),
        sticky: getComputedStyle(document.querySelector(".stick")).position,
        multi: [...document.querySelectorAll(".screen h1, .screen .lead, .screen h2, .screen h3, .chip span")].filter((e) => e.getClientRects().length && (() => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1; })()).map((e) => e.textContent) };
    });
    let m = await measure();
    assert.equal(m.scroll, 0, "fermé : aucun défilement");
    assert.equal(m.under, 0); assert.equal(m.x, 0);
    assert.deepEqual(m.rows, [row], "rangées égales");
    assert.deepEqual(m.open, []); assert.equal(m.sticky, "static");
    await page.click("#btn-medina");
    m = await measure();
    assert.deepEqual(m.open, ["btn-medina"]); assert.deepEqual(m.shown, ["p-medina"]);
    assert.ok(m.scroll > 0, "ouvert : défilement permis"); assert.equal(m.sticky, "sticky");
    assert.deepEqual(m.multi, [], "titres, intertitres, pastilles sur une ligne");
    await page.evaluate(() => { const s = document.querySelector(".screen"); s.scrollTop = s.scrollHeight; });
    m = await measure();
    assert.equal(m.under, 0, "bas de défilement : rien sous le bouton"); assert.equal(m.x, 0);
    await page.click("#btn-mavenue");
    m = await measure();
    assert.deepEqual(m.open, ["btn-mavenue"]); assert.deepEqual(m.shown, ["p-mavenue"], "un seul panneau");
    await page.click("#btn-mavenue");
    m = await measure();
    assert.deepEqual(m.open, []); assert.equal(m.scroll, 0, "tout refermé : plus de défilement");
    await page.click(".action a.btn");
    await page.waitForURL(/\/guest\/transfert\.html#ville$/);
    await page.locator('[data-show="city"][aria-selected="true"]').waitFor({ timeout: 5000 });
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// Restauration : heures fixes de mise en place (Jedy, 28/11 17:01).
for (const [name, w, h] of [["iPhone 16", 390, 844], ["iPhone SE", 375, 667]]) {
  test("Restauration " + name + " : heure fixe par repas (9 h 30, 12 h 30, 19 h), affichée et présélectionnée", async () => {
    const { ctx, page, errors } = await open(w, h, "/guest/restauration.html");
    for (const [meal, value, label] of [["breakfast", "09:30", "9 h 30"], ["lunch", "12:30", "12 h 30"], ["dinner", "19:00", "19 h"]]) {
      await page.click("[data-meal='" + meal + "']");
      assert.deepEqual(await page.locator("[name='time'] option").evaluateAll((o) => o.map((x) => [x.value, x.textContent])), [[value, label]], meal);
      assert.equal(await page.inputValue("[name='time']"), value, meal);
      assert.equal(await page.locator("[data-meal-hours]").innerText(), "Mise en place à " + label + ".", meal);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// Vrai iPhone SE dans Safari (barre d'outils en bas) : fenêtre utile 375×549 (RUN 8).
test("Loisirs v3d 375×549 (Safari SE réel) : aucun texte rogné, cartes égales, tout atteignable en défilant", async () => {
  const { ctx, page, errors } = await open(375, 549, "/guest/loisirs.html");
  const m = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".tile")];
    const lines = (e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; };
    return {
      sizes: [...new Set(tiles.map((t) => { const b = t.getBoundingClientRect(); return b.width.toFixed(1) + "x" + b.height.toFixed(1); }))],
      overflow: tiles.filter((t) => { const tb = t.getBoundingClientRect(); return [...t.querySelectorAll("h2, p")].some((e) => { const b = e.getBoundingClientRect(); return b.bottom > tb.bottom - 1 || b.right > tb.right + 1; }); }).map((t) => t.textContent.trim().slice(0, 20)),
      clipped: tiles.filter((t) => t.scrollHeight > t.clientHeight + 1).length,
      lines: [...document.querySelectorAll(".tile p")].map(lines),
      h2: [...document.querySelectorAll(".tile h2")].filter((e) => lines(e) !== 1).length,
      font: Math.min(...[...document.querySelectorAll(".tile p, .tile h2")].map((e) => parseFloat(getComputedStyle(e).fontSize))),
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  assert.equal(m.sizes.length, 1, "cartes égales " + m.sizes);
  assert.deepEqual(m.overflow, [], "texte dans sa carte");
  assert.equal(m.clipped, 0, "aucun rognage");
  assert.ok(m.lines.every((n) => n <= 3), "corps ≤ 3 lignes " + m.lines);
  assert.equal(m.h2, 0); assert.ok(m.font >= 12); assert.equal(m.x, 0);
  await page.evaluate(() => { const s = document.querySelector(".screen"); s.scrollTop = s.scrollHeight; });
  const end = await page.evaluate(() => Math.round([...document.querySelectorAll(".tile")].pop().getBoundingClientRect().bottom - document.querySelector(".app > .nav").getBoundingClientRect().top));
  assert.ok(end <= 0, "dernière carte au-dessus de la barre en bas de défilement (" + end + ")");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("La Villa v2h 375×549 (Safari SE réel) : titres sur une ligne, cibles ≥ 44 px, toute la liste atteignable", async () => {
  const { ctx, page, errors } = await open(375, 549, "/guest/villa.html");
  const m = await page.evaluate(() => {
    const s = document.querySelector(".screen");
    return { scroll: s.scrollHeight - s.clientHeight, sums: [...document.querySelectorAll(".guide-list summary")].map((x) => x.getBoundingClientRect().height),
      h2: [...document.querySelectorAll(".guide-list h2, .stick h1, .stick .lead")].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  // 10 rangées de 44 px + en-tête ne tiennent pas dans 549 px : défilement court accepté (≈ 39 px), documenté au RUN 8.
  assert.ok(m.scroll <= 45, "défilement de la liste fermée " + m.scroll);
  assert.ok(m.sums.every((hh) => hh >= 44), "cibles ≥ 44 px");
  assert.equal(m.h2, 0); assert.equal(m.x, 0);
  await page.evaluate(() => { const s = document.querySelector(".screen"); s.scrollTop = s.scrollHeight; });
  const end = await page.evaluate(() => Math.round(document.querySelector(".guide-list").getBoundingClientRect().bottom - document.querySelector(".app > .nav").getBoundingClientRect().top));
  assert.ok(end <= 0, "« Votre départ » atteignable au-dessus de la barre (" + end + ")");
  assert.deepEqual(errors, []);
  await ctx.close();
});
