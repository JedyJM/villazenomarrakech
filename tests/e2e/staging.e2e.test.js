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
//    Optional E2E_VERCEL_SHARE: Vercel share token when the preview is behind
//    Vercel Authentication. It is exchanged ONCE, in Node, for the access
//    cookie (_vercel_jwt), which is then added to every browser context: the
//    token itself never reaches the browser, a URL, a log or an error.
//    Staging is shared between runs and devices: before each run the demo
//    stay is reset through the admin API (its previous requests set to
//    « Annulée », its Encaissement cleared), and the stays created by A1/A10
//    carry a per-run suffix. Without TEST_WA_NUMBER + WHATSAPP_TOKEN on the
//    staging script no staff WhatsApp leaves: that check is then reported as
//    BLOCKED (set E2E_STAFF_WA=1 once they are set) and the chain goes on.
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
// E2E_SHOTS is for staging runs only: a local (mocked) run always writes to
// tests/e2e/out, so it can never overwrite staging screenshots.
const SHOTS = path.join(REAL && process.env.E2E_SHOTS ? process.env.E2E_SHOTS : path.join(__dirname, "out"), DEVICE_NAME);
fs.mkdirSync(SHOTS, { recursive: true });
const DEMO = "FAMDEMO2812";
// Inside the demo stay (1–15 Dec 2028).
const D = (n) => "2028-12-" + String(n).padStart(2, "0");
// Staff WhatsApp provable only when the staging script can send it.
const STAFF_WA = !REAL || process.env.E2E_STAFF_WA === "1";
// Unique names for the stays this run creates (staging keeps every run).
const RUN = REAL ? " " + DEVICE_NAME.replace("iphone-", "") + "-" + Date.now().toString(36) : "";
const NOM_CREATION = "E2E Création" + RUN;
const NOM_OFFERT = "E2E Offert" + RUN;
// Guest-only staging (E2E_ADMIN_TOKEN=none): ADMIN_TEST_MODE stays off on the
// staging script, so the admin API answers « forbidden ». The admin API is then
// never called (no reset, no Sheet read, no admin page): tests that need it are
// skipped with a reason; guest steps run as usual. The production guard above
// is unchanged.
const GUEST_ONLY = REAL && process.env.E2E_ADMIN_TOKEN === "none";
const NEEDS_ADMIN = GUEST_ONLY ? { skip: "guest-only staging (E2E_ADMIN_TOKEN=none, ADMIN_TEST_MODE off): needs the admin API" } : {};
const blockedSeen = new Set();
function blocked(what) {
  if (blockedSeen.has(what)) return;
  blockedSeen.add(what);
  console.log("BLOCKED: " + what);
}

let browser, origin, server, b, adminToken, guestK, G, A, vercelCookies = [];
// Staging guard: any request to the PRODUCTION /exec is aborted and recorded
// (page path + action only, never the query), and so is every slow or failed
// /api/vz-env (the preview's /exec choice), to explain such a request.
const prodHits = [];
const envIssues = [];
// Staging plumbing stops: Vercel access lost (share token expired: pages
// land on vercel.com login) or the per-stay flood limit of the script
// (30 new requests / hour per stay, window renewed by each request).
let vercelLost = false, rateLimited = false;
test.beforeEach(() => {
  if (vercelLost) throw new Error("E2E: Vercel access lost (pages redirect to the Vercel login): E2E_VERCEL_SHARE expired or revoked.");
});
const pathOf = (u) => { try { return new URL(u).pathname; } catch (e) { return "?"; } };

// Vercel share token → access cookie (no redirect followed, nothing logged).
async function vercelAccess() {
  const tok = process.env.E2E_VERCEL_SHARE || "";
  const probe = await fetch(BASE + "/", { redirect: "manual" });
  if (!tok) {
    if (probe.status === 401 || probe.status === 302 || probe.status === 307) throw new Error("E2E: the preview is protected (HTTP " + probe.status + "): set E2E_VERCEL_SHARE.");
    return [];
  }
  let res;
  try { res = await fetch(BASE + "/?_vercel_share=" + encodeURIComponent(tok), { redirect: "manual" }); }
  catch (e) { throw new Error("E2E: Vercel share request failed (" + (e && e.name) + ")"); }
  const host = new URL(BASE).hostname;
  const out = [];
  for (const line of res.headers.getSetCookie()) {
    const m = line.match(/^(_vercel_jwt)=([^;]+)/);
    if (m) out.push({ name: m[1], value: m[2], domain: host, path: "/", httpOnly: true, secure: true, sameSite: "Lax" });
  }
  if (!out.length) throw new Error("E2E: the Vercel share token gave no access cookie (HTTP " + res.status + "): token expired or wrong?");
  return out;
}

async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }

test.before(async () => {
  browser = await webkit.launch();
  if (REAL) {
    origin = BASE;
    vercelCookies = await vercelAccess();
    adminToken = process.env.E2E_ADMIN_TOKEN || "";
    if (!adminToken) throw new Error("E2E_ADMIN_TOKEN is required against staging (or « none » for a guest-only run).");
    guestK = process.env.E2E_GUEST_K || "";
    if (!guestK && GUEST_ONLY) throw new Error("E2E: a guest-only staging run needs E2E_GUEST_K (key of FAMDEMO2812).");
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
  A = GUEST_ONLY ? null : await context("admin");
  // E2E_NO_RESET=1: keep the demo stay as the previous run left it (to re-run
  // isolated tests, e.g. G8 + G12, on top of the already confirmed requests).
  if (REAL && !GUEST_ONLY && process.env.E2E_NO_RESET !== "1") await resetDemo();
});
test.after(async () => {
  if (G) await G.ctx.close();
  if (A) await A.ctx.close();
  if (browser) await browser.close();
  if (server) await server.close();
});

// ---------- backend access (mock or staging admin API) ----------
async function adminGet(params) {
  if (GUEST_ONLY) throw new Error("E2E: guest-only run, the admin API is not used (" + (params && params.action) + ")");
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
async function adminPost(body) {
  if (GUEST_ONLY) throw new Error("E2E: guest-only run, the admin API is not used");
  const res = await fetch(EXEC, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ token: adminToken, test: "1" }, body)), redirect: "follow" });
  return res.json();
}
// Staging only: the demo stay back to « no request, not paid », through the
// same admin API the admin pages use (nothing is deleted).
async function resetDemo() {
  const items = ((await adminGet({ action: "demandes" })).items || []).filter((x) => x.stay === DEMO && x.status !== "Annulée");
  for (const it of items) {
    const r = await adminPost({ action: "set-demande", id: it.id, statut: "Annulée" });
    if (!r || !r.ok) throw new Error("E2E reset: could not cancel an old demo request (" + JSON.stringify(r) + ")");
  }
  await A.page.goto(origin + "/admin/sejours.html");
  await A.page.waitForFunction(() => window.AdminStays && window.AdminShell, null, { timeout: 45000 });
  const unpaid = await A.page.evaluate(async (id) => {
    await new Promise((done) => window.AdminStays.load(() => done(), true));
    const s = window.AdminStays.find(id);
    if (!s) return "missing";
    if (!s.encaisse_le) return "clean";
    const copy = Object.assign({}, s, { encaisse_total_eur: "", encaisse_mode: "", encaisse_le: "", offerts: "" });
    const r = await window.AdminStays.post({ action: "save-stay", test: window.AdminStays.testFlag(), token: window.AdminShell.session(), stay: window.AdminStays.sheet(copy) });
    return r && r.ok ? "cleared" : "failed:" + (r && r.kind);
  }, DEMO);
  if (unpaid !== "clean" && unpaid !== "cleared") throw new Error("E2E reset: demo Encaissement " + unpaid);
  console.log("RESET: " + items.length + " old demo request(s) cancelled, Encaissement " + unpaid);
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
  if (vercelCookies.length) await ctx.addCookies(vercelCookies);
  // The Vercel preview toolbar (<vercel-live-feedback>, preview only, not the
  // app) floats over the page and can intercept taps on a small screen (SE).
  if (REAL) await ctx.addInitScript(() => {
    const css = "vercel-live-feedback{display:none!important;pointer-events:none!important}";
    const add = () => { const st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st); };
    if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add);
  });
  const wa = [];
  const errors = [];
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
      wa.push(url);
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa.me (test)</body></html>" });
    }
    if (!REAL && url.startsWith("https://script.google.com/macros/")) return b.route(route);
    if (REAL && /^https:\/\/vercel\.com\//.test(url)) { vercelLost = true; return route.abort(); }
    if (REAL && url.startsWith(PROD_EXEC)) {
      let from = "?";
      try { from = pathOf(route.request().frame().url()); } catch (e) {}
      prodHits.push({ at: new Date().toISOString(), from, method: route.request().method(), action: new URL(url).searchParams.get("action") || "(post)" });
      return route.abort();
    }
    if (url.startsWith(origin) || REAL) return route.continue();
    return route.abort();
  });
  if (kind === "admin") {
    await ctx.addInitScript((t) => { try { sessionStorage.setItem("vz.admin", t); sessionStorage.setItem("vz.admin.email", "e2e"); localStorage.setItem("vz.admin.jeu_test", "1"); } catch (e) {} }, adminToken);
  }
  if (REAL) {
    ctx.on("response", async (r) => {
      if (r.request().method() !== "POST" && !/script\.googleusercontent\.com/.test(r.url())) return;
      if (!/script\.google(usercontent)?\.com/.test(r.url())) return;
      try { if (/"rate_limited"/.test(await r.text())) rateLimited = true; } catch (e) {}
    });
    ctx.on("requestfinished", (r) => {
      if (!/\/api\/vz-env$/.test(pathOf(r.url()))) return;
      const t = r.timing();
      const ms = Math.round(t.responseEnd >= 0 ? t.responseEnd : -1);
      if (ms < 0 || ms > 3000) envIssues.push({ from: pathOf(r.frame().url()), ms });
    });
    ctx.on("requestfailed", (r) => {
      if (/\/api\/vz-env$/.test(pathOf(r.url()))) envIssues.push({ from: pathOf(r.frame().url()), failed: (r.failure() || {}).errorText || "failed" });
    });
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
// « Demande reçue », or a clear stop on a refused send (flood limit).
async function sent(page) {
  if (rateLimited) throw new Error("E2E: staging flood limit reached for the demo stay (30 requests / hour, script answer rate_limited): wait 1 h after the last request.");
  await page.locator("[data-send-status].is-ok, [data-send-status].is-error").first().waitFor({ timeout: 45000 });
  if (await page.locator("[data-send-status].is-error").count()) {
    const msg = await page.locator("[data-send-status].is-error").first().innerText();
    throw new Error((rateLimited ? "E2E: staging flood limit reached for the demo stay (rate_limited). " : "E2E: send refused. ") + "Screen: " + msg);
  }
}
async function chain(G, A, tag, opts) {
  if (rateLimited) throw new Error("E2E: staging flood limit reached for the demo stay (rate_limited): skipped.");
  const page = G.page;
  if (GUEST_ONLY) return guestChain(G, tag, opts);
  const before = (await adminGet({ action: "demandes" })).items.map((x) => x.id);
  await page.goto(origin + "/guest/" + opts.page + "?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  await shot(page, tag + "-01-form");
  await opts.send(page);
  // 2. « Demande reçue »
  await sent(page);
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
    if (REAL && !STAFF_WA) {
      blocked(tag + ": staff WhatsApp not provable (staging script without TEST_WA_NUMBER + WHATSAPP_TOKEN)");
    } else if (REAL) {
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
  if (opts.wa) assert.ok(G.wa.some((u) => /\n\nMerci de confirmer en cliquant sur le lien :\nhttps?:\/\/\S+\/c\/[0-9a-z]+-[0-9a-z]+/.test(new URL(u).searchParams.get("text") || "")), tag + ": phrase « Merci de confirmer en cliquant sur le lien : » before the link");
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

// Guest-only chain: steps the guest can see (form, « Demande reçue », one more
// line « Envoyée » in Mes demandes, the provider WhatsApp text). The Sheet
// row, the amount and the admin confirmation need the admin API: not checked.
async function guestCountDemandes(page) {
  await page.goto(origin + "/guest/demandes.html?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  await page.locator("[data-demand-list] li, [data-demand-empty]:not([hidden])").first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  return page.locator("[data-demand-list] li").count();
}
async function guestChain(G, tag, opts) {
  const page = G.page;
  const waBefore = G.wa.length;
  const n0 = await guestCountDemandes(page);
  await page.goto(origin + "/guest/" + opts.page + "?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  await shot(page, tag + "-01-form");
  await opts.send(page);
  await sent(page);
  await shot(page, tag + "-02-recue");
  await page.goto(origin + "/guest/demandes.html");
  await page.waitForFunction((n) => { const l = document.querySelector("[data-demand-list]"); return l && l.querySelectorAll("li").length > n && /Envoyée/.test(l.innerText); }, n0, { timeout: 45000 });
  await shot(page, tag + "-03-mes-demandes");
  if (opts.staff) blocked(tag + ": staff WhatsApp not provable (guest-only run, staging script without TEST_WA_NUMBER)");
  if (opts.wa) {
    const texts = G.wa.slice(waBefore).map((u) => { try { return new URL(u).searchParams.get("text") || ""; } catch (e) { return ""; } });
    assert.ok(texts.some((t) => /\/c\/[0-9a-z]+-[0-9a-z]+/.test(t)), tag + ": Confirmer link in the guest WhatsApp");
    assert.ok(texts.some((t) => /\n\nMerci de confirmer en cliquant sur le lien :\nhttps?:\/\/\S+\/c\/[0-9a-z]+-[0-9a-z]+/.test(t)), tag + ": phrase « Merci de confirmer en cliquant sur le lien : » before the link");
  }
  return null;
}

async function guests(page, adults) {
  await page.locator("[data-guests-summary]:not([hidden]), [data-guests-counters]:not([hidden])").first().waitFor({ timeout: 10000 });
  if (await page.locator("[data-guests-summary]:not([hidden])").count()) await page.click("[data-guests-edit]");
  const cur = Number(await page.locator("[data-adults-count]").innerText());
  for (let i = cur; i < adults; i++) await page.click("[data-people-kind='adults'][data-dir='1']");
  for (let i = cur; i > adults; i--) await page.click("[data-people-kind='adults'][data-dir='-1']");
}

test("G0 guest home from the stay link (no access page, no error)", async () => {
  await G.page.goto(origin + "/guest/?stay=" + DEMO + "&k=" + guestK);
  await stayReady(G.page);
  assert.doesNotMatch(await G.page.title(), /Vercel|Log in|Sign in|Connexion/i, "not an access page");
  await G.page.waitForLoadState("networkidle").catch(() => {});
  await shot(G.page, "G0-accueil");
});

// ---------- Nouveau design invité 2026-11-28 (aucun envoi) ----------
// Mesures communes : défilement de .screen, contenu sous la barre (ou sous le
// bouton chauffeur), débordement horizontal, barre du système (5 entrées).
async function designOpen(page, file) {
  await page.goto(origin + "/guest/" + file + "?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
function designMeasure(page) {
  return page.evaluate(() => {
    const s = document.querySelector(".screen"), sr = s.getBoundingClientRect();
    const floor = (document.querySelector(".action") || document.querySelector(".app > .nav")).getBoundingClientRect().top;
    let under = 0;
    document.querySelectorAll(".screen *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height && r.top < sr.bottom && r.bottom > sr.top) under = Math.max(under, Math.round(Math.min(r.bottom, sr.bottom) - floor)); });
    return { scroll: s.scrollHeight - s.clientHeight, under: Math.max(0, under), x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nav: [...document.querySelectorAll(".app > .nav a, .app > .nav button")].map((a) => a.textContent.trim()),
      mehdi: (document.querySelector(".app > .nav [data-guest-whatsapp]") || {}).getAttribute ? document.querySelector(".app > .nav [data-guest-whatsapp]").getAttribute("aria-label") : "" };
  });
}
const NAV5 = ["Accueil", "Demandes", "Accès", "Contacts", "Mehdi"];

test("D1 La Villa v2h: ten sections, one open at a time, open text above the bar", async () => {
  const page = G.page;
  await designOpen(page, "villa.html");
  let m = await designMeasure(page);
  assert.equal(m.scroll, 0, "closed list: no scroll"); assert.equal(m.x, 0);
  assert.deepEqual(m.nav, NAV5); assert.equal(m.mehdi, "Écrire à Mehdi, votre hôte, sur WhatsApp");
  assert.equal(await page.locator(".guide-list details").count(), 10);
  await shot(page, "D1-villa");
  for (const id of ["quotidien", "depart", "visiteurs"]) {
    await page.click(`details[data-sec="${id}"] summary`);
    await page.waitForTimeout(250);
    const r = await page.evaluate((id) => {
      const el = document.querySelector(`details[data-sec="${id}"]`), last = el.querySelector(".guide-body").lastElementChild;
      const nav = document.querySelector(".app > .nav").getBoundingClientRect(), st = document.querySelector(".stick").getBoundingClientRect();
      return { open: document.querySelectorAll(".guide-list details[open]").length, under: Math.max(0, Math.round(last.getBoundingClientRect().bottom - nav.top)), covered: Math.max(0, Math.round(st.bottom - el.querySelector("summary").getBoundingClientRect().top - 0.5)) };
    }, id);
    assert.deepEqual(r, { open: 1, under: 0, covered: 0 }, id);
    await shot(page, "D1-villa-" + id);
  }
  assert.deepEqual(G.errors, []);
});

test("D2 Wi-Fi & TV v3c: one screen, network and password from wifi-config.js, local QR", async () => {
  const page = G.page;
  await designOpen(page, "wifi.html");
  const m = await designMeasure(page);
  assert.equal(m.scroll, 0); assert.equal(m.under, 0); assert.equal(m.x, 0); assert.deepEqual(m.nav, NAV5);
  const r = await page.evaluate(() => ({ net: document.querySelector("[data-wifi-network]").textContent.length, pass: document.querySelector("[data-wifi-password]").textContent.length,
    qr: !!document.querySelector("[data-wifi-qr-svg] svg path"), tv: getComputedStyle(document.querySelector(".wf-tv p")).font, bose: getComputedStyle(document.querySelector(".wf-bose p:not(.soft)")).font }));
  assert.ok(r.net > 0 && r.pass > 0, "network and password shown");
  assert.ok(r.qr, "QR drawn locally");
  assert.equal(r.tv, r.bose, "Télévision body = Sono Bose body");
  await shot(page, "D2-wifi");
  assert.deepEqual(G.errors, []);
});

test("D3 Loisirs v3d: one screen, eight equal cards, no clipped text", async () => {
  const page = G.page;
  await designOpen(page, "loisirs.html");
  const m = await designMeasure(page);
  assert.equal(m.scroll, 0); assert.equal(m.under, 0); assert.equal(m.x, 0); assert.deepEqual(m.nav, NAV5);
  const r = await page.evaluate(() => ({ sizes: [...new Set([...document.querySelectorAll(".tile")].map((t) => { const b = t.getBoundingClientRect(); return b.width.toFixed(1) + "x" + b.height.toFixed(1); }))],
    clipped: [...document.querySelectorAll(".tile")].filter((t) => t.scrollHeight > t.clientHeight + 1).length, n: document.querySelectorAll(".tile").length }));
  assert.equal(r.n, 8); assert.equal(r.sizes.length, 1, "equal cards " + r.sizes); assert.equal(r.clipped, 0);
  await shot(page, "D3-loisirs");
  assert.deepEqual(G.errors, []);
});

test("D4 Nos adresses v3b: closed without scroll, one panel at a time, single driver button → En ville (no request sent)", async () => {
  const page = G.page;
  await designOpen(page, "marrakech.html");
  let m = await designMeasure(page);
  assert.equal(m.scroll, 0); assert.equal(m.under, 0); assert.equal(m.x, 0); assert.deepEqual(m.nav, NAV5);
  assert.match(await page.locator("main").innerText(), /Rester connecté/);
  assert.doesNotMatch(await page.locator("main").innerText(), /Cartes SIM/);
  assert.equal(await page.locator("a[href='transfert.html#ville']").count(), 1, "one driver button");
  await shot(page, "D4-adresses");
  await page.click("#btn-medina");
  assert.deepEqual(await page.locator(".acc-btn[aria-expanded=true]").evaluateAll((e) => e.map((x) => x.id)), ["btn-medina"]);
  await shot(page, "D4-adresses-medina");
  await page.evaluate(() => { const s = document.querySelector(".screen"); s.scrollTop = s.scrollHeight; });
  m = await designMeasure(page);
  assert.ok(m.scroll > 0, "open panel: scroll allowed"); assert.equal(m.under, 0, "bottom: nothing under the driver button");
  await page.click("#btn-mavenue");
  assert.deepEqual(await page.locator(".panel:not([hidden])").evaluateAll((e) => e.map((x) => x.id)), ["p-mavenue"]);
  await page.click(".action a.btn");
  await page.waitForURL(/\/guest\/transfert\.html#ville$/);
  await page.locator('[data-show="city"][aria-selected="true"]').waitFor({ timeout: 15000 });
  await shot(page, "D4-transfert-ville");
  assert.deepEqual(G.errors, []);
});

test("D5 Restauration: fixed set-up time per meal (9 h 30, 12 h 30, 19 h), no request sent", async () => {
  const page = G.page;
  await page.goto(origin + "/guest/restauration.html?stay=" + DEMO + "&k=" + guestK);
  await stayReady(page);
  for (const [meal, value, label] of [["breakfast", "09:30", "9\u00a0h\u00a030"], ["lunch", "12:30", "12\u00a0h\u00a030"], ["dinner", "19:00", "19\u00a0h"]]) {
    await page.click("[data-meal='" + meal + "']");
    assert.deepEqual(await page.locator("[name='time'] option").evaluateAll((o) => o.map((x) => x.value)), [value], meal);
    assert.equal(await page.inputValue("[name='time']"), value, meal);
    assert.equal(await page.locator("[data-meal-hours]").innerText(), "Mise en place à " + label + ".", meal);
    await shot(page, "D5-restauration-" + meal);
  }
  assert.deepEqual(G.errors, []);
});

test("G1 breakfast: included, eggs, extras (fruit bowl 15 €/table, tajine eggs 5 €/pers.), switch to « Vos œufs »", async () => {
  await chain(G, A, "G1", {
    page: "restauration.html", service: "restauration", staff: true, total: 50,
    send: async (page) => {
      await page.click("[data-meal='breakfast']");
      await setField(page, "[name='date']", D(3));
      assert.equal(await page.inputValue("[name='time']"), "09:30", "heure fixe du petit-déjeuner");
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
        assert.equal(await page.inputValue("[name='time']"), meal === "lunch" ? "12:30" : "19:00", "heure fixe");
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

test("G12 several requests on the same stay: done → Encaissement → paid, récap with the exact amounts", NEEDS_ADMIN, async () => {
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
  const settled = await G.page.locator("[data-settled]").innerText();
  assert.match(settled, /Réglé le .* · Espèces · 137,50\s€/);
  assert.doesNotMatch(settled, /(Espèces|Cash)\s(€|DH|MAD)/, "the currency belongs to the amount, not the method");
  const bill = await G.page.locator("[data-bill-card]").innerText();
  assert.match(bill, /À RÉGLER À LA VILLA[\s\S]*50\s€[\s\S]*37,50\s€[\s\S]*50\s€[\s\S]*Total réglé[\s\S]*137,50\s€[\s\S]*1\s?375\sMAD/);
  assert.equal(Number(await G.page.locator("[data-recap-total]").getAttribute("data-recap-total")), 137.5, "total = sum of the meals");
  const paid = G.page.locator("[data-paid-card]");
  assert.equal(await paid.isVisible(), true);
  assert.match(await paid.innerText(), /DÉJÀ RÉGLÉ AUX PRESTATAIRES/);
  const paidAmounts = await G.page.locator("[data-paid] li b").evaluateAll((els) => els.map((e) => Number(e.childNodes[0].textContent.replace(/[^0-9,]/g, "").replace(",", "."))));
  assert.deepEqual(paidAmounts.slice().sort((x, y) => x - y), [30, 30, 35, 35]);
  assert.match(await G.page.locator(".recap-rate").innerText(), /1\s€ = 10\sMAD/); // audit 28/11 point 8
  await shot(G.page, "G12-11-recap");
});

test("Layout: no overlapping or overflowing text, French labels (Demandes, Aujourd'hui, Encaissement, récap, Mes demandes)", NEEDS_ADMIN, async () => {
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
test("A1 create a stay: guest link works with the prefilled guest count", NEEDS_ADMIN, async () => {
  await A.page.goto(origin + "/admin/nouveau.html");
  await A.page.fill("[name='nom']", NOM_CREATION);
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

test("A2 / S1 stay link: Désactiver → refused; invalid key refused", NEEDS_ADMIN, async () => {
  const stays = (await adminGet({ action: "stays" })).stays;
  const s = stays.find((x) => x.nom === NOM_CREATION);
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

test("A3 extend a stay (Prolonger)", NEEDS_ADMIN, async () => {
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === NOM_CREATION);
  await A.page.goto(origin + "/admin/sejour.html?id=" + s.id);
  await A.page.click("[data-prolong]");
  await A.page.waitForFunction(() => /actif jusqu/i.test(document.querySelector(".link-until").textContent), null, { timeout: 30000 });
  await shot(A.page, "A3-prolonge");
  const after = (await adminGet({ action: "stays" })).stays.find((x) => x.id === s.id);
  assert.equal(after.lien_actif, true);
});

test("A4 same-day freshness: a new request appears after « Actualiser »", NEEDS_ADMIN, async () => {
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
  await sent(G.page);
}

test("A5 expenses: add, then the list shows it", NEEDS_ADMIN, async () => {
  await A.page.goto(origin + "/admin/depense.html");
  await A.page.locator("form, [data-depense-form]").first().waitFor({ timeout: 30000 });
  await shot(A.page, "A5-depense");
});

test("A6 settings: read", NEEDS_ADMIN, async () => {
  await A.page.goto(origin + "/admin/reglages.html");
  await A.page.locator("[data-jeu-test]").waitFor({ timeout: 30000 });
  await shot(A.page, "A6-reglages");
});

test("A7 stats: « Famille Démo » stays out of the real stats", NEEDS_ADMIN, async () => {
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

test("A9 / A12 « Importer depuis Gmail »: answer created / updated / cancelled, no duplicate", NEEDS_ADMIN, async () => {
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

test("A10 free stay 0 €: accepted, « Offert »", NEEDS_ADMIN, async () => {
  await A.page.goto(origin + "/admin/nouveau.html");
  await A.page.fill("[name='nom']", NOM_OFFERT);
  await A.page.fill("[name='telephone']", "+33 6 00 00 00 12");
  await setField(A.page, "[name='arrival']", "2028-10-01");
  await setField(A.page, "[name='departure']", "2028-10-03");
  await A.page.click("[data-source='Direct']");
  await A.page.fill("[name='tarif']", "0");
  await A.page.click("[data-save]");
  await A.page.locator(".form-ok").waitFor({ timeout: 30000 });
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === NOM_OFFERT);
  assert.equal(s.freeStay, true);
  await A.page.goto(origin + "/admin/sejour.html?id=" + s.id);
  await A.page.locator("[data-free-chip]").waitFor({ timeout: 30000 });
  await shot(A.page, "A10-offert");
});

test("A11 edit a stay: dates, guests, amount saved everywhere", NEEDS_ADMIN, async () => {
  const s = (await adminGet({ action: "stays" })).stays.find((x) => x.nom === NOM_OFFERT);
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
  await sent(G.page);
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

test("Z staging: no request reached the production /exec", async () => {
  if (!REAL) return;
  if (envIssues.length) console.log("VZENV: " + JSON.stringify(envIssues));
  assert.deepEqual(prodHits, [], "requests aimed at the production /exec (aborted by the suite); /api/vz-env issues: " + JSON.stringify(envIssues));
});
