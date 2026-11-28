// Récap header after payment (G12): the method name never carries a
// currency — « Réglé le … · Espèces · 137,50 € », never « Espèces € · … € ».
// Every stored mode (Espèces €, Espèces DH, PayPal), French and English.
// The Sheet keeps « Espèces € » / « Espèces DH » (admin Encaissement).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, day, createBackend, browser } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

const CASES = [
  // stored mode, French name, English name
  ["Espèces €", "Espèces", "Cash"],
  ["Espèces DH", "Espèces", "Cash"],
  ["PayPal", "PayPal", "PayPal"],
];

async function settledLine(mode, lang) {
  const b = createBackend();
  const rows = b.box.sheets["Réservations"].rows;
  const head = rows[0];
  rows[1][head.indexOf("encaisse_le")] = day(0);
  rows[1][head.indexOf("encaisse_mode")] = mode;
  rows[1][head.indexOf("encaisse_total_eur")] = 137.5;
  const P = await phone(srv.origin, b);
  try {
    const base = srv.origin + (lang === "en" ? "/guest/en/" : "/guest/");
    await P.page.goto(base + "?stay=" + b.STAY_ID + "&k=" + b.key);
    await P.page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 15000 });
    await P.page.goto(base + "recap.html");
    await P.page.locator("[data-settled]:not([hidden]) [data-settled-line]").waitFor({ timeout: 15000 });
    await P.page.waitForFunction(() => /\d/.test(document.querySelector("[data-settled-line]").textContent), null, { timeout: 15000 });
    const line = (await P.page.locator("[data-settled-line]").textContent()).replace(/ /g, " ");
    assert.equal(P.errors.length, 0, "no JS error: " + P.errors.join(" | "));
    return line;
  } finally {
    await P.ctx.close();
  }
}

for (const [mode, fr, en] of CASES) {
  test("récap header, « " + mode + " » in French → « " + fr + " · 137,50 € »", async () => {
    const line = await settledLine(mode, "fr");
    assert.match(line, new RegExp("^Réglé le .+ · " + fr + " · 137,50 €$"), line);
    assert.doesNotMatch(line, /(€|DH)\s·/, "no currency on the method: " + line);
  });
  test("récap header, « " + mode + " » in English → « " + en + " · €137.50 »", async () => {
    const line = await settledLine(mode, "en");
    assert.match(line, new RegExp("^Paid on .+ · " + en + " · €137\\.50$"), line);
    assert.doesNotMatch(line, /(€|DH)\s·/, "no currency on the method: " + line);
  });
}
