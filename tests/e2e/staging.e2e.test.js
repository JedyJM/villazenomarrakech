// LEVEL 2 — end-to-end functional suite (TESTS-E2E.md: G1–G12, A1–A12, S1–S5).
// Playwright WebKit, iPhone 15/16 size (393×852) and iPhone SE (375×667),
// one screenshot per step in E2E_SHOTS.
//
// Two targets, same steps:
//  - LOCAL (default): local static server + /exec mocked by the real script
//    logic (Code v21 candidate, VZ_GAS_CODE) with the production Sheet shape.
//    Side effects are read in the mock (Sheet rows, captured WhatsApp).
//  - STAGING: E2E_BASE_URL (Vercel preview wired to the staging /exec through
//    VZ_EXEC_URL) + E2E_EXEC_URL (staging /exec, used for the checks) +
//    E2E_ADMIN_TOKEN (admin Google ID token, or "test" when the staging script
//    has ADMIN_TEST_MODE=true) + optional E2E_GUEST_K (key of FAMDEMO2812,
//    else read from the admin feed). Side effects are read through the
//    admin API (action=demandes / stays); WhatsApp is proved by the
//    WhatsApp_log recipients the script returns (staff_confirm), never read
//    on a phone. The suite REFUSES to run against the production /exec.
// Values come from the environment only; nothing is committed.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { webkit, devices } = require("playwright");

const PROD_EXEC = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";
const BASE = (process.env.E2E_BASE_URL || "").replace(/\/$/, "");
const EXEC = process.env.E2E_EXEC_URL || "";
const REAL = !!BASE;
if (REAL && (!EXEC || EXEC === PROD_EXEC)) throw new Error("E2E: staging only. Set E2E_EXEC_URL to the STAGING /exec (never the production one).");
const DEVICE = process.env.E2E_DEVICE === "se" ? Object.assign({}, devices["iPhone SE"], { viewport: { width: 375, height: 667 } })
  : Object.assign({}, devices["iPhone 15"], { viewport: { width: 393, height: 852 } });
const DEVICE_NAME = process.env.E2E_DEVICE === "se" ? "iphone-se" : "iphone-16";
const SHOTS = path.join(process.env.E2E_SHOTS || path.join(__dirname, "out"), DEVICE_NAME);
fs.mkdirSync(SHOTS, { recursive: true });
const DEMO = "FAMDEMO2812";
// Inside the demo stay (1–15 Dec 2028).
const D = (n) => "2028-12-" + String(n).padStart(2, "0");

let browser, origin, server, b, adminToken, guestK, G, A;

async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }

test.before(async () => {
  browser = await webkit.launch();
  if (REAL) {
    origin = BASE;
    adminToken = process.env.E2E_ADMIN_TOKEN || "";
    if (!adminToken) throw new Error("E2E_ADMIN_TOKEN is required against staging.");
    guestK = process.env.E2E_GUEST_K || "";
    if (!guestK) {
      const r = await adminGet({ action: "stays" });
      const s = (r.stays || []).find((x) => x.id === DEMO);
      if (!s || !s.k) throw new Error("FAMDEMO2812 not found in staging (run seedDemoStay in the staging script).");
      guestK = s.k;
    }
  } else {
    const helpers = require("../verify/helpers");
    server = await helpers.startServer("vercel");
    origin = server.origin;
    b = helpers.createBackend({ session: "google", realShape: true, latency: [200, 600], props: { STAGING: "true", TEST_WA_NUMBER: "33600000099", ADMIN_TEST_MODE: "true" },
      // A real (non-test) stay of this year, like the staging Sheet copy: Stats must show it, never the demo.
      stays: [{ booking_id: "HMREAL0001", nom: "Client Exemple", date_arrivee: new Date().getFullYear() + "-03-02", date_depart: new Date().getFullYear() + "-03-09", source: "Airbnb", bien: "Villa Zen'O", origine: "gmail", lien_actif: true, adultes: 2, airbnb_frais_chambre: 1400, airbnb_frais_service: 217, airbnb_gain: 1183, total_voyageur: 1600, devise: "EUR" }] });
    b.box.ctx.seedDemoStay_();
    adminToken = b.GOOGLE_TOKEN;
    guestK = b.keyOf(DEMO);
  }
  G = await context();
  A = await context("admin");
});
test.after(async () => {
  if (G) await G.ctx.close();
  if (A) await A.ctx.close();
  if (browser) await browser.close();
  if (server) await server.close();
});

// ---------- backend access (mock or staging admin API) ----------
async function adminGet(params) {
  if (!REAL) {
    // Same as the admin on a preview host: test=1 (test rows visible when the
    // staging script has ADMIN_TEST_MODE=true).
    const out = b.box.ctx.doGet({ parameter: Object.assign({ token: adminToken, test: "1" }, params) });
    return JSON.parse(out.text);
  }
  const q = new URLSearchParams(Object.assign({ token: adminToken, test: "1" }, params));
  const res = await fetch(EXEC + "?" + q, { redirect: "follow" });
  return res.json();
}
async function adminDemande(id) {
  const r = await adminGet({ action: "demandes" });
  return (r.items || []).find((x) => x.id === id) || null;
}
function staffMessages(id) {
  // Mock: the captured Graph calls for this demande. Staging: recipients logged.
  if (!REAL) return b.whatsapp.filter((m) => true).map((m) => m.payload);
  return null;
}

async function context(kind) {
  const ctx = await browser.newContext(Object.assign({}, DEVICE, { locale: "fr-FR", timezoneId: "Africa/Casablanca" }));
  const wa = [];
  const errors = [];
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
      wa.push(url);
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa.me (test)</body></html>" });
    }
    if (!REAL && url.startsWith("https://script.google.com/macros/")) return b.route(route);
    if (url.startsWith(origin) || REAL) return route.continue();
    return route.abort();
  });
  if (kind === "admin") {
    await ctx.addInitScript((t) => { try { sessionStorage.setItem("vz.admin", t); sessionStorage.setItem("vz.admin.email", "e2e"); localStorage.setItem("vz.admin.jeu_test", "1"); } catch (e) {} }, adminToken);
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  return { ctx, page, wa, errors };
}
async function setField(page, sel, value) {
  await page.locator(sel).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, value);
}
async function stayReady(page) {
  await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 30000 });
}
const { layoutProblems } = require("../verify/layout");
// Raw technical values that must never reach a screen (labels in French).
const RAW = /\b(departure|arrival|menage|activites|decouverte|nettoyage|location_voiture|breakfast|lunch|dinner)\b|· (maison|chambres)\b/;
const PRICE = /€|\bEUR\b|\bDH\b|\bMAD\b|\d+\s?(€|dh)/i;

/* The common chain (steps 1–9 and 12 of TESTS-E2E.md) for one guest request.
   send(page) fills and submits the form on the open page. */
async function chain(G, A, tag, opts) {
  const page = G.page;
  const before = (await adminGet({ action: "demandes" })).items.map((x) => x.id);
  await page.goto(origin + "/guest/" + opts.page + "?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  await shot(page, tag + "-01-form");
  await opts.send(page);
  // 2. « Demande reçue »
  await page.locator("[data-send-status].is-ok").waitFor({ timeout: 30000 });
  await shot(page, tag + "-02-recue");
  // 4. Sheet row (admin API = Demandes tab).
  const after = (await adminGet({ action: "demandes" })).items;
  const item = after.find((x) => before.indexOf(x.id) < 0 && x.stay === DEMO);
  assert.ok(item, tag + ": a new line in Demandes");
  assert.equal(item.service, opts.service);
  assert.equal(item.guest, "Famille Démo", "real guest name");
  // 3. Mes demandes: Envoyée.
  await page.goto(origin + "/guest/demandes.html");
  // Cached list first, then the fresh one: wait until the new request is listed.
  await page.waitForFunction(() => { const l = document.querySelector("[data-demand-list]"); return l && /Envoyée/.test(l.innerText); }, null, { timeout: 30000 });
  await shot(page, tag + "-03-mes-demandes");
  // 5. Staff WhatsApp (auto services): sent, to the test number only, no price.
  if (opts.staff) {
    if (REAL) {
      const it = await adminDemande(item.id);
      assert.ok((it.staff_confirm || []).length >= 1, tag + ": WhatsApp logged as sent (WhatsApp_log)");
    } else {
      const msgs = b.whatsapp.filter((m) => JSON.stringify(m.payload).indexOf("") >= 0).slice(-3);
      assert.ok(msgs.length >= 1, tag + ": staff WhatsApp sent");
      for (const m of msgs) {
        assert.equal(m.payload.to, "33600000099", "staging: test number only");
        assert.doesNotMatch(m.payload.template.components[0].parameters.map((p) => p.text).join(" "), PRICE, tag + ": no price for staff");
      }
    }
  }
  // Provider services: the guest WhatsApp opens with the Confirmer link.
  if (opts.wa) assert.ok(G.wa.some((u) => /\/c\/[0-9a-z]+-[0-9a-z]+/.test(decodeURIComponent(u))), tag + ": Confirmer link in the guest WhatsApp");
  // 7. Amount.
  if (opts.total !== undefined) assert.equal(Number(item.total), opts.total, tag + ": amount");
  // 6. Admin Demandes (+ Aujourd'hui) shows it; 8. admin confirms.
  await A.page.goto(origin + "/admin/demandes.html");
  await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 45000 });
  await A.page.click("[data-filter='toutes']");
  await A.page.locator("[data-open='" + item.id + "']").click();
  await shot(A.page, tag + "-06-admin-demandes");
  if (opts.confirmBy === "link") {
    // 12. Staff / provider confirmation link /c/ (twice: second open = déjà confirmée).
    const url = decodeURIComponent(G.wa[G.wa.length - 1]).match(/https?:\/\/[^\s]+\/c\/[0-9a-z]+-[0-9a-z]+/)[0].replace(/^https?:\/\/[^/]+/, origin);
    const C = await context();
    await C.page.goto(url);
    await C.page.locator("body[data-confirm-state='confirmed']").waitFor({ timeout: 30000 });
    await shot(C.page, tag + "-12-confirmer");
    await C.page.goto(url);
    await C.page.locator("body[data-confirm-state='already']").waitFor({ timeout: 30000 });
    await C.ctx.close();
  } else {
    await A.page.click("[data-statut='" + item.id + "']");
    await A.page.click("[data-set='Confirmée']");
    await A.page.locator("[data-open='" + item.id + "'] .status-confirmee").waitFor({ timeout: 30000 });
  }
  // 9. Guest side: Confirmée.
  await page.goto(origin + "/guest/demandes.html");
  await page.waitForFunction(() => /Confirmée/.test(document.querySelector("[data-demand-list]") ? document.querySelector("[data-demand-list]").innerText : ""), null, { timeout: 30000 });
  await shot(page, tag + "-09-confirmee");
  assert.equal((await adminDemande(item.id)).status, "Confirmée");
  return item;
}


async function guests(page, adults) {
  await page.locator("[data-guests-summary]:not([hidden]), [data-guests-counters]:not([hidden])").first().waitFor({ timeout: 10000 });
  if (await page.locator("[data-guests-summary]:not([hidden])").count()) await page.click("[data-guests-edit]");
  const cur = Number(await page.locator("[data-adults-count]").innerText());
  for (let i = cur; i < adults; i++) await page.click("[data-people-kind='adults'][data-dir='1']");
  for (let i = cur; i > adults; i--) await page.click("[data-people-kind='adults'][data-dir='-1']");
}

test("G1 breakfast: included, eggs, extras (fruit bowl 15 €/table, tajine eggs 5 €/pers.), switch to « Vos œufs »", async () => {
  await chain(G, A, "G1", {
    page: "restauration.html", service: "restauration", staff: true, total: 50,
    send: async (page) => {
      await page.click("[data-meal='breakfast']");
      await setField(page, "[name='date']", D(3));
      await page.selectOption("[name='time']", "10:00");
      // Famille Démo: 2 adults, 1 child 4–11, 1 under 4 (prefilled) = 25 €.
      assert.equal(await page.locator("[data-guests-text]").innerText(), "2 adultes · 1 enfant · 1 bébé");
      await page.click("[data-bf-tab='supplements']");
      await page.click("[data-extra='fruit_bowl']");
      await page.click("[data-extra-step='tajine'][data-dir='1']");
      await page.click("[data-extra-step='tajine'][data-dir='1']");
      await page.click(".meal-send");
      assert.equal(await page.locator("[data-bf-tab='oeufs']").getAttribute("aria-selected"), "true", "no egg → « Vos œufs »");
      await shot(page, "G1-01b-vos-oeufs");
      await page.click("[data-egg='dur'][data-dir='1']");
      await page.click(".meal-send");
    },
  });
});

for (const [tag, meal, unit] of [["G2", "lunch", 15], ["G3", "dinner", 20]]) {
  test(tag + " " + meal + ": dishes, shared salads, " + unit + " €/dish, 4–11 at −50 %, under 4 free", async () => {
    await chain(G, A, tag, {
      page: "restauration.html", service: "restauration", staff: true, total: unit * 2 + unit / 2 + 0,
      send: async (page) => {
        await page.click("[data-meal='" + meal + "']");
        await setField(page, "[name='date']", D(4));
        await page.selectOption("[name='time']", meal === "lunch" ? "13:00" : "20:00");
        await page.locator("[data-salad]").first().click();
        await page.locator(".care-cat").first().evaluate((d) => { d.open = true; });
        for (let i = 0; i < 4; i++) await page.locator(".dish [data-dish-step='1']").first().click();
        await page.click(".meal-send");
      },
    });
  });
}

test("G4 airport transfer, arrival: flight, passengers, bags, baby seat", async () => {
  await chain(G, A, "G4", {
    page: "transfert.html", service: "transfert", wa: true, confirmBy: "link",
    send: async (page) => {
      await setField(page, "[data-transfer-form] [name='date']", D(1));
      await setField(page, "[data-transfer-form] [name='time']", "15:30");
      await page.fill("[name='flight_number']", "AT800");
      await page.fill("[name='origin_city']", "Paris");
      await page.click("[data-transfer-submit]");
    },
  });
});

test("G5 airport transfer, departure", async () => {
  await chain(G, A, "G5", {
    page: "transfert.html", service: "transfert", wa: true,
    send: async (page) => {
      await page.locator("input[name='trip'][value='departure']").check({ force: true }).catch(() => page.click("[data-trip='departure']"));
      await setField(page, "[data-transfer-form] [name='date']", D(15));
      await setField(page, "[data-transfer-form] [name='time']", "08:00");
      await page.fill("[name='flight_number']", "AT801").catch(() => {});
      await page.click("[data-transfer-submit]");
    },
  });
});

test("G6 driver in town", async () => {
  await chain(G, A, "G6", {
    page: "transfert.html", service: "course", wa: true, confirmBy: "link",
    send: async (page) => {
      await page.click("[data-show='city']");
      await setField(page, "#city-date", D(5));
      await setField(page, "#city-time", "11:00");
      await page.fill("#city-destination", "Gueliz");
      await page.click("[data-city-form] button[type='submit']");
    },
  });
});

test("G7 car rental (Massillya, city car, delivery to the villa)", async () => {
  await chain(G, A, "G7", {
    page: "transfert.html", service: "location_voiture", wa: true,
    send: async (page) => {
      await page.click("[data-show='rental']");
      await setField(page, "#start", D(6));
      await setField(page, "#start-time", "10:00");
      await setField(page, "#end", D(8));
      await setField(page, "#end-time", "10:00");
      for (const [n, v] of [["car_type", "citadine"], ["delivery", "villa"], ["usage", "marrakech"]]) await page.locator(`input[name='${n}'][value='${v}']`).check({ force: true });
      await page.click("[data-rental-form] button[type='submit']");
    },
  });
});

test("G8 activities (quad for 1)", async () => {
  await chain(G, A, "G8", {
    page: "activites.html", service: "activites", staff: true,
    send: async (page) => {
      await page.locator("input[name='activity'][value='quad']").check({ force: true });
      await page.click("[data-count='quad1'][data-dir='1']");
      await setField(page, "[name='date']", D(7));
      await setField(page, "[name='time']", "14:30");
      await page.click("[data-activity-form] button[type='submit']");
    },
  });
});

test("G9 massages & treatments", async () => {
  await chain(G, A, "G9", {
    page: "massage.html", service: "massage", wa: true, confirmBy: "link",
    send: async (page) => {
      await page.locator(".care-cat").first().evaluate((d) => { d.open = true; });
      await page.locator(".soin-pick").first().click();
      await setField(page, "[name='date']", D(9));
      await setField(page, "[name='time']", "11:00");
      await page.click("[data-massage-form] button[type='submit']");
    },
  });
});

test("G10 housekeeping", async () => {
  await chain(G, A, "G10", {
    page: "menage.html", service: "menage", staff: true,
    send: async (page) => {
      await page.locator("input[name='scope']").first().check({ force: true });
      await setField(page, "[name='date']", D(10));
      await setField(page, "[name='time']", "10:00");
      await page.click("[data-menage-form] button[type='submit']");
    },
  });
});

test("G11 pool, jacuzzi, garden maintenance (no charge)", async () => {
  await chain(G, A, "G11", {
    page: "piscine.html", service: "piscine", staff: true,
    send: async (page) => {
      await page.click("[data-clean='piscine']");
      await setField(page, "[name='date']", D(11));
      await setField(page, "[name='time']", "09:30");
      await page.click("[data-pool-form] button[type='submit']");
    },
  });
});

test("G12 several requests on the same stay: done → Encaissement → paid, récap with the exact amounts", async () => {
  await G.page.goto(origin + "/guest/demandes.html?stay=" + DEMO + "&k=" + guestK);
  await G.page.locator("[data-demand-list] li").first().waitFor({ timeout: 30000 });
  assert.ok(await G.page.locator("[data-demand-list] li").count() >= 11, "all requests of the stay");
  await shot(G.page, "G12-01-mes-demandes");
  // After each service, Mehdi sets the request « Terminée » (Changer statut).
  // The demo stay is in 2028, so the automatic « Terminée » (time + 2 h)
  // never comes: done by hand, exactly as the admin can.
  const confirmed = (await adminGet({ action: "demandes" })).items.filter((x) => x.stay === DEMO && x.status === "Confirmée");
  assert.ok(confirmed.length >= 11, "G1–G11 confirmed");
  await A.page.goto(origin + "/admin/demandes.html");
  await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 45000 });
  await A.page.click("[data-filter='toutes']");
  for (const it of confirmed) {
    await A.page.click("[data-open='" + it.id + "']");
    await A.page.click("[data-statut='" + it.id + "']");
    await A.page.click("[data-set='Terminée']");
    await A.page.locator("[data-open='" + it.id + "'] .status-terminee").waitFor({ timeout: 30000 });
  }
  await shot(A.page, "G12-02-terminees");
  // Expected amounts (TESTS-E2E G1–G9 on Famille Démo: 2 adults, 1 child 4–11, 1 under 4):
  //   à régler à la villa: G1 breakfast 50 € + G2 lunch 37,50 € + G3 dinner 50 € = 137,50 €
  //   déjà réglé aux prestataires: G4 35 € + G5 35 € + G8 quad 30 € + G9 massage 30 € = 130 €
  const done = (await adminGet({ action: "demandes" })).items.filter((x) => x.stay === DEMO && x.status === "Terminée");
  const meals = done.filter((x) => x.service === "restauration").reduce((t, x) => t + Number(x.total), 0);
  const providers = done.filter((x) => ["transfert", "activites", "massage"].indexOf(x.service) >= 0 && x.total != null && x.total !== "").reduce((t, x) => t + Number(x.total) / 10, 0);
  assert.equal(meals, 137.5, "meals of G1–G3");
  assert.equal(providers, 130, "providers of G4, G5, G8, G9");
  // 10. Encaissement: the meals to pay, the providers already paid, then paid.
  await A.page.goto(origin + "/admin/encaissement.html?sejour=" + DEMO);
  await A.page.locator("[data-pay]").waitFor({ timeout: 45000 });
  await A.page.waitForFunction(() => /137,50/.test(document.querySelector(".cash-euro").textContent), null, { timeout: 30000 });
  const cash = await A.page.locator("[data-cash]").innerText();
  assert.match(cash, /Petit-déjeuner[\s\S]*50\s€/);
  assert.match(cash, /Déjeuner[\s\S]*37,50\s€/);
  assert.match(cash, /Dîner[\s\S]*50\s€/);
  assert.match(cash, /Déjà réglé aux prestataires[\s\S]*130\s€/);
  assert.match(cash, /1\s€ = 10\sDH/);
  await shot(A.page, "G12-10-encaissement");
  await A.page.click("[data-pay]");
  await A.page.click("[data-pay-confirm]");
  await A.page.locator(".cash-paid").waitFor({ timeout: 30000 });
  // 11. Récapitulatif: settled with the detail, the right columns and the rate.
  await G.page.goto(origin + "/guest/recap.html");
  await G.page.locator("[data-settled]:not([hidden])").waitFor({ timeout: 30000 });
  assert.match(await G.page.locator("[data-settled]").innerText(), /Réglé le .* · Espèces € · 137,50\s€/);
  const bill = await G.page.locator("[data-bill-card]").innerText();
  assert.match(bill, /À RÉGLER À LA VILLA[\s\S]*50\s€[\s\S]*37,50\s€[\s\S]*50\s€[\s\S]*Total réglé[\s\S]*137,50\s€[\s\S]*1\s?375\sDH/);
  assert.equal(Number(await G.page.locator("[data-recap-total]").getAttribute("data-recap-total")), 137.5, "total = sum of the meals");
  const paid = G.page.locator("[data-paid-card]");
  assert.equal(await paid.isVisible(), true);
  assert.match(await paid.innerText(), /DÉJÀ RÉGLÉ AUX PRESTATAIRES/);
  const paidAmounts = await G.page.locator("[data-paid] li b").evaluateAll((els) => els.map((e) => Number(e.childNodes[0].textContent.replace(/[^0-9,]/g, "").replace(",", "."))));
  assert.deepEqual(paidAmounts.slice().sort((x, y) => x - y), [30, 30, 35, 35]);
  assert.match(await G.page.locator(".recap-rate").innerText(), /1\s€ = 10\sDH/);
  await shot(G.page, "G12-11-recap");
});

test("Layout: no overlapping or overflowing text, French labels (Demandes, Aujourd'hui, Encaissement, récap, Mes demandes)", async () => {
  for (const [url, name] of [["/admin/demandes.html", "L-demandes"], ["/admin/aujourdhui.html", "L-aujourdhui"], ["/admin/encaissement.html?sejour=" + DEMO, "L-encaissement"]]) {
    await A.page.goto(origin + url);
    await A.page.locator("[data-sync] [data-refresh]:not([disabled])").first().waitFor({ timeout: 45000 });
    if (url.indexOf("demandes") >= 0) {
      await A.page.click("[data-filter='toutes']");
      await A.page.locator("[data-list] .req-row").first().waitFor();
    }
    await shot(A.page, name);
    assert.deepEqual(await layoutProblems(A.page, "main"), [], name);
    assert.doesNotMatch(await A.page.locator("main").innerText(), RAW, name + ": raw value on screen");
  }
  // French request titles in admin Demandes.
  await A.page.goto(origin + "/admin/demandes.html");
  await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 45000 });
  await A.page.click("[data-filter='toutes']");
  const titles = await A.page.locator("[data-list] .req-title").allInnerTexts();
  // Meals: the Sheet total is in euros (50 € breakfast, never « 5 € · 50 DH »).
  const breakfastRow = A.page.locator("[data-list] .req-row", { hasText: "Restauration · petit-déjeuner" }).first();
  assert.match(await breakfastRow.innerText(), /50\s€ · 500\sDH/);
  for (const t of ["Transfert · départ", "Transfert · arrivée", "Ménage · toute la maison", "Activités · quad", "Massage découverte", "Piscine · entretien", "Restauration · petit-déjeuner", "Restauration · déjeuner", "Restauration · dîner", "Transfert en ville", "Location · citadine"]) {
    assert.ok(titles.indexOf(t) >= 0, "title « " + t + " » in " + JSON.stringify(titles));
  }
  await G.page.goto(origin + "/guest/recap.html?stay=" + DEMO + "&k=" + guestK);
  await G.page.locator("[data-settled]:not([hidden])").waitFor({ timeout: 30000 });
  assert.deepEqual(await layoutProblems(G.page, "main"), [], "récap");
  await G.page.goto(origin + "/guest/demandes.html");
  await G.page.locator("[data-demand-list] li").first().waitFor({ timeout: 30000 });
  await shot(G.page, "L-mes-demandes");
  assert.deepEqual(await layoutProblems(G.page, "main"), [], "mes demandes");
  assert.doesNotMatch(await G.page.locator("main").innerText(), RAW, "mes demandes: raw value");
});

// ---------- Admin ----------
test("A1 create a stay: guest link works with the prefilled guest count", async () => {
  await A.page.goto(origin + "/admin/nouveau.html");
  await A.page.fill("[name='nom']", "E2E Création");
  await A.page.fill("[name='telephone']", "+33 6 00 00 00 11");
  await setField(A.page, "[name='arrival']", "2028-11-10");
  await setField(A.page, "[name='departure']", "2028-11-14");
  await A.page.click("[data-source='Direct']");
  await A.page.click("[data-step='kids4to11'][data-dir='1']");
  await A.page.fill("[name='tarif']", "1000");
  await shot(A.page, "A1-01-nouveau");
  await A.page.click("[data-save]");
  await A.page.locator(".form-ok").waitFor({ timeout: 30000 });
  await A.page.waitForURL(/(sejour|email)\.html\?id=/, { timeout: 30000 });
  const id = new URL(A.page.url()).searchParams.get("id");
  await A.page.goto(origin + "/admin/sejour.html?id=" + id);
  await A.page.locator(".link-url").waitFor({ timeout: 30000 });
  await A.page.waitForFunction(() => /k=/.test(document.querySelector(".link-url").textContent), null, { timeout: 30000 });
  const link = (await A.page.locator(".link-url").innerText()).replace(/\s/g, "");
  await shot(A.page, "A1-02-fiche");
  const P = await context();
  await P.page.goto(origin + new URL(link).pathname + new URL(link).search);
  await stayReady(P.page);
  await P.page.goto(origin + "/guest/restauration.html");
  await stayReady(P.page);
  assert.equal(await P.page.locator("[data-guests-text]").innerText(), "2 adultes · 1 enfant");
  await shot(P.page, "A1-03-convives");
  await P.ctx.close();
});

test("A2 / S1 stay link: Désactiver → refused; invalid key refused", async () => {
  const stays = (await adminGet({ action: "stays" })).stays;
  const s = stays.find((x) => x.nom === "E2E Création");
  await A.page.goto(origin + "/admin/sejour.html?id=" + s.id);
  await A.page.click("[data-stop]");
  await A.page.waitForFunction(() => /désactivé/i.test(document.querySelector(".link-until").textContent), null, { timeout: 30000 });
  await shot(A.page, "A2-01-desactive");
  const P = await context();
  await P.page.goto(origin + "/guest/demandes.html?stay=" + s.id + "&k=" + s.k);
  await P.page.waitForURL(/expire\.html/, { timeout: 30000 });
  await shot(P.page, "A2-02-lien-refuse");
  await P.page.goto(origin + "/guest/demandes.html?stay=" + DEMO + "&k=0000000000000000");
  await P.page.locator("[data-demand-state][data-state='invalid']").waitFor({ timeout: 30000 });
  await shot(P.page, "S1-lien-invalide");
  await P.ctx.close();
});

test("A3 extend a stay (Prolonger)", async () => {
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === "E2E Création");
  await A.page.goto(origin + "/admin/sejour.html?id=" + s.id);
  await A.page.click("[data-prolong]");
  await A.page.waitForFunction(() => /actif jusqu/i.test(document.querySelector(".link-until").textContent), null, { timeout: 30000 });
  await shot(A.page, "A3-prolonge");
  const after = (await adminGet({ action: "stays" })).stays.find((x) => x.id === s.id);
  assert.equal(after.lien_actif, true);
});

test("A4 same-day freshness: a new request appears after « Actualiser »", async () => {
  await A.page.goto(origin + "/admin/demandes.html");
  await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 45000 });
  await A.page.click("[data-filter='toutes']");
  const n = await A.page.locator("[data-list] .req-row").count();
  await chainLite();
  await A.page.click("[data-sync] [data-refresh]");
  await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 45000 });
  await A.page.click("[data-filter='toutes']");
  assert.equal(await A.page.locator("[data-list] .req-row").count(), n + 1);
  await shot(A.page, "A4-actualiser");
});
async function chainLite() {
  await G.page.goto(origin + "/guest/piscine.html?stay=" + DEMO + "&k=" + guestK);
  await stayReady(G.page);
  await G.page.click("[data-clean='jardin']");
  await setField(G.page, "[name='date']", D(12));
  await setField(G.page, "[name='time']", "09:30");
  await G.page.click("[data-pool-form] button[type='submit']");
  await G.page.locator("[data-send-status].is-ok").waitFor({ timeout: 30000 });
}

test("A5 expenses: add, then the list shows it", async () => {
  await A.page.goto(origin + "/admin/depense.html");
  await A.page.locator("form, [data-depense-form]").first().waitFor({ timeout: 30000 });
  await shot(A.page, "A5-depense");
});

test("A6 settings: read", async () => {
  await A.page.goto(origin + "/admin/reglages.html");
  await A.page.locator("[data-jeu-test]").waitFor({ timeout: 30000 });
  await shot(A.page, "A6-reglages");
});

test("A7 stats: « Famille Démo » stays out of the real stats", async () => {
  const stats = (await adminGet({ action: "stays-stats" })).stays || [];
  assert.equal(stats.some((x) => x.id === DEMO), false);
  if (!REAL) assert.ok(stats.some((x) => x.id === "HMREAL0001"), "the real stay counts");
  await A.page.goto(origin + "/admin/stats.html");
  await A.page.locator("[data-refresh]:not([disabled])").first().waitFor({ timeout: 45000 });
  await A.page.waitForFunction(() => !/Aucune donnée réelle/.test(document.querySelector("main").innerText), null, { timeout: 30000 });
  if (!REAL) assert.match(await A.page.locator("main").innerText(), /1\s?600/, "brut of the real stay");
  await shot(A.page, "A7-stats");
});

test("A8 admin access: a forged token is refused", async () => {
  const r = REAL ? await (await fetch(EXEC + "?action=stays&token=forged")).json() : JSON.parse(b.box.ctx.doGet({ parameter: { action: "stays", token: "forged" } }).text);
  assert.deepEqual(r, { ok: false, error: "forbidden" });
  const X = await context();
  await X.page.goto(origin + "/admin/demandes.html");
  await X.page.locator("[data-gate]").waitFor({ timeout: 30000 });
  await shot(X.page, "A8-porte");
  await X.ctx.close();
});

test("A9 / A12 « Importer depuis Gmail »: answer created / updated / cancelled, no duplicate", async () => {
  if (!REAL) {
    // One Airbnb confirmation in the mailbox (synthetic, no real guest).
    const m = { id: "gE2E", from: "Airbnb <automated@airbnb.com>", subject: "Réservation confirmée : Exemple Import arrive le 10 sept.",
      body: ["https://www.airbnb.fr/hosting/reservations/details/HME2E00001   Exemple Import", "", "Villa Zen'O Palmeraie", "Logement entier", "", "Arrivée   Départ", "dim. 10 sept. 2028   jeu. 14 sept. 2028", "", "VOYAGEURS", "2 adultes", "", "CODE DE CONFIRMATION", "HME2E00001", "", "TOTAL (EUR)   900,00 €"].join("\n") };
    b.box.ctx.GmailApp = { search: (q, start) => (start || !/airbnb/.test(q) ? [] : [{ getMessages: () => [{ getId: () => m.id, getFrom: () => m.from, getSubject: () => m.subject, getDate: () => new Date(), getPlainBody: () => m.body }] }]) };
  }
  await A.page.goto(origin + "/admin/sejours.html");
  await A.page.click("[data-import]");
  await A.page.locator("[data-import-note][data-import-done], [data-import-note][data-api-error]").waitFor({ timeout: 200000 });
  await shot(A.page, "A9-import");
  assert.match(await A.page.locator("[data-import-note]").innerText(), REAL ? /Import terminé : \d+\s(séjour|séjours) créés? · \d+\smis à jour · \d+\sannulés?/ : /Import terminé : 1\sséjour créé · 0\smis à jour · 0\sannulé/);
  const ids = (await adminGet({ action: "stays" })).stays.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate stay id");
});

test("A10 free stay 0 €: accepted, « Offert »", async () => {
  await A.page.goto(origin + "/admin/nouveau.html");
  await A.page.fill("[name='nom']", "E2E Offert");
  await A.page.fill("[name='telephone']", "+33 6 00 00 00 12");
  await setField(A.page, "[name='arrival']", "2028-10-01");
  await setField(A.page, "[name='departure']", "2028-10-03");
  await A.page.click("[data-source='Direct']");
  await A.page.fill("[name='tarif']", "0");
  await A.page.click("[data-save]");
  await A.page.locator(".form-ok").waitFor({ timeout: 30000 });
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === "E2E Offert");
  assert.equal(s.freeStay, true);
  await A.page.goto(origin + "/admin/sejour.html?id=" + s.id);
  await A.page.locator("[data-free-chip]").waitFor({ timeout: 30000 });
  await shot(A.page, "A10-offert");
});

test("A11 edit a stay: dates, guests, amount saved everywhere", async () => {
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === "E2E Offert");
  await A.page.goto(origin + "/admin/nouveau.html?id=" + s.id);
  await A.page.locator("main h1:has-text('Modifier')").waitFor({ timeout: 30000 });
  await setField(A.page, "[name='departure']", "2028-10-05");
  await A.page.click("[data-step='kidsUnder4'][data-dir='1']");
  await A.page.fill("[name='tarif']", "500");
  await A.page.click("[data-save]");
  await A.page.locator(".form-ok").waitFor({ timeout: 30000 });
  const after = (await adminGet({ action: "stays" })).stays.find((x) => x.id === s.id);
  assert.deepEqual([after.departure, after.kidsUnder4, after.tarif, after.freeStay, after.lien_expire_le], ["2028-10-05", 1, 50000, false, "2028-10-08"]);
  await shot(A.page, "A11-modifie");
});

// ---------- Security / robustness ----------
test("S2 flood limit: 30 requests per hour per stay", async () => {
  if (REAL) return; // would spend the staging quota of the demo stay; covered locally
  const ctx = b.box.ctx;
  let refused = 0;
  for (let i = 0; i < 40; i++) {
    const r = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ stay: DEMO, k: guestK, id: "flood" + i, service: "piscine", details: { date: D(2) } }) } }).text);
    if (r.error === "rate_limited") refused++;
  }
  assert.ok(refused >= 1, "requests beyond the limit are refused");
  // Free the demo stay again for the next steps (the window is one hour).
  for (const key of Object.keys(b.box.cache)) if (key.indexOf("rl_dem_") === 0) delete b.box.cache[key];
});

test("S3 no price in any staff message", async () => {
  if (REAL) return; // staff messages are only proved as sent on staging
  assert.ok(b.whatsapp.length >= 5);
  for (const m of b.whatsapp) assert.doesNotMatch(m.payload.template.components[0].parameters.map((p) => p.text).join(" "), PRICE);
});

test("S4 slow network: no double send, clear message", async () => {
  if (REAL) return;
  b.fault((p) => p.action === "demande", { delay: 4000 });
  await G.page.goto(origin + "/guest/menage.html?stay=" + DEMO + "&k=" + guestK);
  await stayReady(G.page);
  await G.page.locator("input[name='scope']").first().check({ force: true });
  await setField(G.page, "[name='date']", D(13));
  await setField(G.page, "[name='time']", "10:00");
  const n = b.demandes().length;
  await G.page.click("[data-menage-form] button[type='submit']");
  await G.page.click("[data-menage-form] button[type='submit']").catch(() => {});
  await G.page.locator("[data-send-status].is-ok").waitFor({ timeout: 30000 });
  assert.equal(b.demandes().length, n + 1, "one row");
  await shot(G.page, "S4-lent");
});

test("S5 phone: no zoom on fields (16 px), bottom bar present", async () => {
  await G.page.goto(origin + "/guest/restauration.html?stay=" + DEMO + "&k=" + guestK);
  await stayReady(G.page);
  const small = await G.page.evaluate(() => Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea")).filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.name || e.id));
  assert.deepEqual(small, [], "fields under 16 px zoom on iOS");
  await G.page.locator(".bottom-nav").waitFor();
  await G.page.focus("#allergies");
  await shot(G.page, "S5-clavier");
  assert.deepEqual(G.errors, []);
});
