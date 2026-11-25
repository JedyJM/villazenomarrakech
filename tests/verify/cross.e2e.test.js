// Cross-cutting checks: every Apps Script call awaited with an error state
// (mocked failures), Mes demandes never blank across reloads, the name is
// never « Invité » while the stay loads, no iPhone zoom (16px, touch-action).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, day, setField, createBackend, browser, shot } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

async function seeded() {
  const b = createBackend();
  for (const [id, svc, d] of [["s1", "transfert", { trip_type: "arrival", date: day(2), flight_arrival_time: "15:30" }], ["s2", "transfert", { trip_type: "departure", date: day(6), pickup_time: "07:15" }]]) {
    b.box.ctx.doPost({ postData: { contents: JSON.stringify({ stay: b.STAY_ID, k: b.key, id, token: "tok" + id, service: svc, nom_client: "Invité", details: Object.assign({ booking_id: b.STAY_ID, token: "tok" + id }, d) }) } });
  }
  return b;
}
// Exactly one visible state, never « title + button only ».
async function pageState(page) {
  return page.evaluate(() => {
    const vis = (el) => el && !el.hidden && el.offsetParent !== null;
    const list = document.querySelector("[data-demand-list]");
    const empty = document.querySelector("[data-demand-empty]");
    const state = document.querySelector("[data-demand-state]");
    if (vis(list) && list.children.length) return "list";
    if (vis(empty)) return "empty";
    if (vis(state)) return state.getAttribute("data-state") || "state";
    return "blank";
  });
}

test("Mes demandes: slow, failed, malformed, refused answers → loading / error + Réessayer / message, never blank", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  const url = srv.origin + "/guest/demandes.html?stay=" + b.STAY_ID + "&k=" + b.key;
  // Slow (3 s): loading line from the first paint.
  b.fault("list", { delay: 3000 });
  await page.goto(url);
  await page.waitForTimeout(400);
  assert.equal(await pageState(page), "loading");
  await page.locator("[data-demand-list] li").first().waitFor({ timeout: 10000 });
  assert.equal(await pageState(page), "list");
  // Fail every try (3 aborts): error + Réessayer, the cached list stays visible.
  for (let i = 0; i < 3; i++) b.fault("list", { abort: true });
  await page.reload();
  await page.locator("[data-demand-state][data-state='error']").waitFor({ timeout: 15000 });
  assert.equal(await pageState(page), "list", "last good list kept (stale) with the error line");
  await page.click("[data-demand-state] [data-retry]");
  await page.locator("[data-demand-state][data-state='ok']").waitFor({ state: "attached", timeout: 10000 });
  // No cache + failures: error state (not « aucune demande »).
  await page.evaluate(() => localStorage.removeItem("villazeno.stayPack"));
  for (let i = 0; i < 3; i++) b.fault("list", { status: 500 });
  await page.reload();
  await page.locator("[data-demand-state][data-state='error']").waitFor({ timeout: 15000 });
  assert.equal(await page.locator("[data-demand-empty]").isHidden(), true, "never « aucune demande » after a failure");
  assert.match(await page.locator("[data-demand-state]").innerText(), /Impossible de charger vos demandes/);
  await shot(page, "mes-demandes-error.png");
  await page.click("[data-demand-state] [data-retry]");
  await page.locator("[data-demand-list] li").first().waitFor({ timeout: 10000 });
  // Malformed body (Google HTML error page) x3 → error, then fine.
  for (let i = 0; i < 3; i++) b.fault("list", { body: "<html>Error</html>" });
  await page.evaluate(() => localStorage.removeItem("villazeno.stayPack"));
  await page.reload();
  await page.locator("[data-demand-state][data-state='error']").waitFor({ timeout: 15000 });
  // Refused link → clear message.
  b.fault("list", { json: { ok: false, error: "invalid_link" } });
  await page.goto(url);
  await page.locator("[data-demand-state][data-state='invalid']").waitFor({ timeout: 10000 });
  assert.match(await page.locator("[data-demand-state]").innerText(), /n’est plus valable/);
  await P.ctx.close();
});

test("Mes demandes: 10 reloads (URL with k, then stored key only), list every time", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  await page.goto(srv.origin + "/guest/demandes.html?stay=" + b.STAY_ID + "&k=" + b.key);
  for (let i = 0; i < 10; i++) {
    if (i === 5) await page.goto(srv.origin + "/guest/demandes.html");
    else if (i) await page.reload();
    if (i % 3 === 1) b.fault("list", { delay: 1500 });
    await page.waitForTimeout(150);
    assert.notEqual(await pageState(page), "blank", "reload " + i);
    await page.locator("[data-demand-list] li").nth(1).waitFor({ timeout: 10000 });
    const text = await page.locator("[data-demand-list]").innerText();
    assert.match(text, /15:30/);
    assert.match(text, /07:15/);
    assert.doesNotMatch(text, /00:00/);
  }
  await P.ctx.close();
});

test("guest POST failure: visible error + Réessayer on the received panel, retry saves once", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  await page.goto(srv.origin + "/guest/menage.html?stay=" + b.STAY_ID + "&k=" + b.key);
  await page.waitForFunction(() => window.GuestStay.snapshot().state === "ok");
  await setField(page, "[name='date']", day(1));
  await setField(page, "[name='time']", "10:00");
  b.fault((p) => p.method === "POST", { abort: true });
  await page.click("[data-menage-form] button[type='submit']");
  await page.locator("[data-send-status].is-error [data-retry]").waitFor({ timeout: 15000 });
  assert.equal(b.demandes().filter((d) => d.service === "menage").length, 0);
  await page.click("[data-send-status] [data-retry]");
  await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
  assert.equal(b.demandes().filter((d) => d.service === "menage").length, 1);
  await P.ctx.close();
});

test("name never « Invité » while the stay is loading: submit waits, no WhatsApp opened", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  b.fault("list", { delay: 5000 });
  await page.goto(srv.origin + "/guest/transfert.html?stay=" + b.STAY_ID + "&k=" + b.key);
  await page.click("[data-show='city']");
  await setField(page, "#city-date", day(2));
  await setField(page, "#city-time", "11:00");
  await page.fill("#city-destination", "Gueliz");
  await page.click("[data-city-form] button[type='submit']");
  assert.match(await page.locator("[data-city-form] [data-errors]").innerText(), /Chargement de votre séjour/);
  assert.equal(P.wa.length, 0, "no wa.me with a placeholder name");
  await page.waitForFunction(() => window.GuestStay.snapshot().state === "ok", null, { timeout: 15000 });
  await page.click("[data-city-form] button[type='submit']");
  await page.locator("[data-send-status].is-ok").waitFor({ timeout: 15000 });
  assert.match(decodeURIComponent(P.wa[0]), /Nom : Léa Bernard/);
  await P.ctx.close();
});

test("admin reads show an error state on failure (Demandes, Séjours)", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  await page.goto(srv.origin + "/admin/aujourdhui.html?test=1");
  for (let i = 0; i < 3; i++) b.fault("demandes", { abort: true });
  await page.goto(srv.origin + "/admin/demandes.html");
  await page.locator("[data-load-error] [data-retry]").waitFor({ timeout: 15000 });
  await page.click("[data-load-error] [data-retry]");
  await page.locator("[data-load-error]").waitFor({ state: "hidden", timeout: 10000 });
  await page.evaluate(() => { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.indexOf("vz.admin.cache") === 0) localStorage.removeItem(k); } });
  b.fault("stays", { json: { ok: false, error: "forbidden" }, sticky: false });
  await page.goto(srv.origin + "/admin/sejours.html");
  await page.locator("[data-load-error]", { hasText: "Session expirée" }).waitFor({ timeout: 15000 });
  await P.ctx.close();
});

test("no iPhone zoom: every field ≥ 16px, steppers and buttons touch-action: manipulation (guest + admin)", async () => {
  const b = await seeded();
  const P = await phone(srv.origin, b);
  const page = P.page;
  const bad = [];
  const guestPages = ["transfert", "restauration", "menage", "piscine", "activites", "massage"];
  await page.goto(srv.origin + "/admin/aujourdhui.html?test=1");
  for (const path of guestPages.map((p) => "/guest/" + p + ".html?stay=" + b.STAY_ID + "&k=" + b.key).concat(["/admin/nouveau.html", "/admin/reglages.html"])) {
    await page.goto(srv.origin + path);
    await page.waitForTimeout(200);
    const found = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea").forEach((el) => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) out.push((el.name || el.id || el.tagName) + " " + size + "px");
      });
      document.querySelectorAll(".stepper button, button, [data-step], [data-dish-step], [data-soin-step], [data-count], [data-people-kind], [data-egg], [data-city-step]").forEach((el) => {
        const ta = getComputedStyle(el).touchAction;
        if (ta !== "manipulation") out.push("touch-action " + (el.getAttribute("aria-label") || el.textContent.trim().slice(0, 12)) + "=" + ta);
      });
      return out;
    });
    found.forEach((f) => bad.push(path.split("?")[0] + ": " + f));
  }
  assert.deepEqual(bad.slice(0, 15), [], bad.length + " zoom risks");
  await P.ctx.close();
});
