// /exec per environment, browser level (2026-11-28): a Vercel PREVIEW never
// falls back to the production /exec. The page is served under a fake
// preview host (and the real production hosts) by routing it to the local
// server; /api/vz-env is played by the test (slow, 500, not JSON, then
// staging). Every request to an Apps Script /exec is recorded. No network.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { devices } = require("playwright");
const { startServer, browser, createBackend, shot } = require("./helpers");

const fs = require("node:fs");
const path = require("node:path");
// The production /exec, read from the client itself (not copied here).
const PROD_EXEC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "vz-api.js"), "utf8").match(/var PROD_URL = "([^"]+)"/)[1];
const STAGING_EXEC = "https://script.google.com/macros/s/STAGING-test-deployment-id-0000/exec";
const PREVIEW = "https://villazenomarrakech-git-func-2026-11-27-jedyjm.vercel.app";
const FORMULA_A = "Un contretemps de notre côté. Réessayez dans un instant, ou écrivez à Mehdi.";

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

/* iPhone context where `host` serves the site (local files). env(n) answers
   the n-th /api/vz-env request (route). Returns { page, ctx, env: [times],
   exec: [urls] }. */
async function site(host, backend, env) {
  const b = await browser();
  const ctx = await b.newContext(Object.assign({}, devices["iPhone 15"], { locale: "fr-FR", timezoneId: "Africa/Casablanca" }));
  const seen = { env: [], exec: [] };
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(host + "/api/vz-env")) {
      seen.env.push(Date.now());
      return env ? env(seen.env.length, route) : route.fulfill({ status: 404, body: "" });
    }
    if (url.startsWith(host + "/")) {
      const res = await route.fetch({ url: srv.origin + url.slice(host.length) });
      return route.fulfill({ response: res });
    }
    if (url.startsWith("https://script.google.com/macros/")) {
      seen.exec.push(url);
      return backend.route(route);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  return Object.assign(seen, { ctx, page });
}
const slow = (ms, body) => (route) => new Promise((r) => setTimeout(r, ms)).then(() => route.fulfill({ status: 200, contentType: "application/json", body })).catch(() => {});
const fail500 = (route) => route.fulfill({ status: 500, contentType: "text/html", body: "<html>500</html>" });
const notJson = (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Vercel</title>" });
const staging = (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ execUrl: STAGING_EXEC, env: "staging" }) });

test("preview: /api/vz-env slow, then 500, then not JSON → retried, nothing sent to any /exec, « contretemps » shown; « Réessayer » asks again", async () => {
  const backend = createBackend({ realShape: true });
  let healthy = false;
  const S = await site(PREVIEW, backend, (n, route) => {
    if (healthy) return staging(route);
    // 1: answers the staging URL, but too late (> 4 s): must be ignored.
    if (n === 1) return slow(5500, JSON.stringify({ execUrl: STAGING_EXEC }))(route);
    if (n === 2) return fail500(route);
    return notJson(route);
  });
  try {
    await S.page.goto(PREVIEW + "/guest/demandes.html?stay=" + backend.STAY_ID + "&k=" + backend.key);
    // Before the lookup ends, the client exposes no URL (never PROD_URL).
    assert.equal(await S.page.evaluate(() => window.VZApi.URL), "");
    const alert = S.page.locator('[data-api-error="unavailable"]').first();
    await alert.waitFor({ state: "visible", timeout: 20000 });
    assert.equal(S.env.length, 3, "three /api/vz-env tries");
    assert.ok(S.env[1] - S.env[0] >= 3900, "first try timed out (slow) before the second");
    assert.match(await alert.innerText(), new RegExp(FORMULA_A.replace(/[.]/g, "\\.")));
    assert.equal(await alert.locator("[data-retry]").count(), 1, "« Réessayer » offered");
    assert.equal(await S.page.evaluate(() => window.VZApi.env), "unavailable");
    // A write while the URL is unknown: no request either.
    const t0 = S.env.length;
    const post = await S.page.evaluate(() => window.VZApi.post({ action: "noop" }));
    assert.equal(post.kind, "unavailable");
    assert.equal(S.env.length - t0, 3, "a new call asks /api/vz-env again (3 tries)");
    assert.deepEqual(S.exec, [], "no request to any /exec (production or other)");
    await shot(S.page, "preview-env-contretemps.png");
    // /api/vz-env back: « Réessayer » reads the staging /exec, never production.
    healthy = true;
    await S.page.locator('[data-api-error="unavailable"] [data-retry]').first().click();
    await S.page.waitForFunction(() => window.VZApi.env === "staging", null, { timeout: 15000 });
    await S.page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
    assert.ok(S.exec.length >= 1);
    assert.ok(S.exec.every((u) => u.startsWith(STAGING_EXEC)), "staging /exec only");
    assert.equal(S.exec.some((u) => u.startsWith(PROD_EXEC)), false);
    assert.equal(await S.page.evaluate(() => window.VZApi.URL), STAGING_EXEC);
  } finally { await S.ctx.close(); }
});

test("preview: /api/vz-env answers {} (no VZ_EXEC_URL) → no production fallback; English page says it in English", async () => {
  const backend = createBackend({ realShape: true });
  const S = await site(PREVIEW, backend, (n, route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  try {
    await S.page.goto(PREVIEW + "/guest/en/index.html?stay=" + backend.STAY_ID + "&k=" + backend.key);
    const r = await S.page.evaluate(() => window.VZApi.get({ action: "list" }, { retries: 0 }));
    assert.equal(r.kind, "unavailable");
    assert.equal(await S.page.evaluate((x) => window.VZApi.message(x), r), "Something went wrong on our side. Try again in a moment, or write to Mehdi.");
    assert.ok(S.env.length >= 3);
    assert.deepEqual(S.exec, []);
  } finally { await S.ctx.close(); }
});

for (const host of ["https://www.villazenomarrakech.com", "https://villazenomarrakech.vercel.app"]) {
  test("production host " + host + ": unchanged — production /exec at once, no /api/vz-env", async () => {
    const backend = createBackend({ realShape: true });
    const S = await site(host, backend, fail500);
    try {
      await S.page.goto(host + "/guest/demandes.html?stay=" + backend.STAY_ID + "&k=" + backend.key);
      assert.equal(await S.page.evaluate(() => window.VZApi.URL === window.VZApi.PROD_URL && window.VZApi.env === "production"), true);
      assert.equal(await S.page.evaluate(() => window.VZApi.urlReady.then((u) => u === window.VZApi.PROD_URL)), true);
      await S.page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
      assert.equal(S.env.length, 0, "no /api/vz-env request");
      assert.ok(S.exec.length >= 1 && S.exec.every((u) => u.startsWith(PROD_EXEC)), "production /exec");
    } finally { await S.ctx.close(); }
  });
}
