// Functional items of 2026-11-27 in the browser (iPhone 15 WebKit, local
// server, /exec mocked by the real script logic with the PRODUCTION Sheet
// shape: full Réservations headers, Demandes grid of 1000 rows, 60 real-like
// demandes of other stays, 0.3–0.9 s latency per call).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, phone, shot, day, setField, createBackend, browser } = require("./helpers");

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

function newBackend(extra) {
  const b = createBackend(Object.assign({ session: "google", realShape: true, latency: [300, 900] }, extra || {}));
  // Google session (production path): the journey stay is a real admin stay.
  const rows = b.box.sheets["Réservations"].rows;
  rows[1][rows[0].indexOf("origine")] = "admin";
  return b;
}
async function admin(b) {
  const A = await phone(srv.origin, b);
  await A.ctx.addInitScript((t) => { try { sessionStorage.setItem("vz.admin", t); sessionStorage.setItem("vz.admin.email", "admin@verify.test"); localStorage.setItem("vz.admin.jeu_test", "1"); } catch (e) {} }, b.GOOGLE_TOKEN);
  return A;
}
function demande(b, id, when) {
  return [id, new Date().toISOString(), "menage", "maison", "Invité", JSON.stringify({ booking_id: b.STAY_ID, token: "tok" + id, date: when || day(0), time: "10:00" }), "", "Nadera", "Envoyée", "", false];
}
function addDemande(b, row) { b.box.sheets.Demandes.rows.push(row); }
async function stayReady(page) {
  await page.waitForFunction(() => window.GuestStay && window.GuestStay.snapshot().state === "ok", null, { timeout: 20000 });
}

test("1. freshness: Demandes opens from the cache at once, a same-day request appears on the next open and on « Actualiser », never two reads at a time", async () => {
  const b = newBackend();
  const A = await admin(b);
  const page = A.page;
  try {
    await page.goto(srv.origin + "/admin/demandes.html");
    await page.locator("[data-req-loading]").waitFor({ state: "hidden", timeout: 20000 });
    await page.click("[data-filter='aujourd']");
    const before = await page.locator("[data-list] .req-row").count();
    // A guest sends a request today (written in the Sheet).
    addDemande(b, demande(b, "fresh001"));
    // Re-open: cached list painted at once (no « Chargement »), then refreshed.
    b.fault("demandes", { delay: 1500 });
    const t0 = Date.now();
    await page.goto(srv.origin + "/admin/demandes.html");
    await page.locator("[data-list] .req-row").first().waitFor({ timeout: 3000 });
    assert.ok(Date.now() - t0 < 2500, "cached list shown before the script answers");
    assert.equal(await page.locator("[data-req-loading]:not([hidden])").count(), 0, "no loading line over a cached list");
    await page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    await page.click("[data-filter='aujourd']");
    assert.equal(await page.locator("[data-list] .req-row").count(), before + 1, "same-day request visible after the background refresh");
    await shot(page, "func-1-demandes-fresh.png");
    // « Actualiser »: a second request today, tapped three times quickly.
    addDemande(b, demande(b, "fresh002"));
    b.fault("demandes", { delay: 1200 });
    const reads = b.log.filter((e) => e.action === "demandes").length;
    await page.click("[data-sync] [data-refresh]");
    assert.equal(await page.locator("[data-sync] [data-refresh]").isDisabled(), true, "button disabled while reading");
    await page.locator("[data-sync] [data-refresh]").click({ force: true, trial: false }).catch(() => {});
    await page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    assert.equal(b.log.filter((e) => e.action === "demandes").length - reads, 1, "one read for several taps");
    assert.equal(await page.locator("[data-list] .req-row").count(), before + 2);
    assert.match(await page.locator("[data-sync] [data-stamp]").innerText(), /Mis à jour aujourd’hui à \d\d:\d\d/);
    assert.ok(b.inflightMax("demandes") <= 1, "never two demandes reads at the same time");
    assert.deepEqual(A.errors, []);
  } finally { await A.ctx.close(); }
});

test("1. freshness: Aujourd'hui and Encaissement refresh on open and have « Actualiser »", async () => {
  const b = newBackend();
  const A = await admin(b);
  const page = A.page;
  try {
    await page.goto(srv.origin + "/admin/aujourdhui.html");
    await page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    const n0 = Number(await page.locator("[data-alert-count]").innerText());
    addDemande(b, demande(b, "today01", day(1)));
    await page.click("[data-sync] [data-refresh]");
    await page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    assert.equal(Number(await page.locator("[data-alert-count]").innerText()), n0 + 1, "new alert after « Actualiser »");
    addDemande(b, demande(b, "today02", day(1)));
    await page.goto(srv.origin + "/admin/aujourdhui.html");
    await page.waitForFunction((n) => Number(document.querySelector("[data-alert-count]").textContent) === n, n0 + 2, { timeout: 20000 });
    await shot(page, "func-1-aujourdhui.png");
    await page.goto(srv.origin + "/admin/encaissement.html?sejour=" + b.STAY_ID);
    await page.locator("[data-cash] [data-sync] [data-refresh]").waitFor({ timeout: 20000 });
    await page.locator("[data-cash] [data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    const reads = b.log.filter((e) => e.action === "demandes").length;
    await page.click("[data-cash] [data-sync] [data-refresh]");
    await page.locator("[data-cash] [data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
    assert.equal(b.log.filter((e) => e.action === "demandes").length - reads, 1);
    await shot(page, "func-1-encaissement.png");
    for (const action of ["demandes", "stays"]) assert.ok(b.inflightMax(action) <= 1, action + ": no stacked reads");
    assert.deepEqual(A.errors, []);
  } finally { await A.ctx.close(); }
});

const AIRBNB = (code, name, a, d) => ({
  id: "g" + code, from: "Airbnb <automated@airbnb.com>", date: new Date().toISOString(),
  subject: "Réservation confirmée : " + name + " arrive le 10 déc.",
  body: ["https://www.airbnb.fr/hosting/reservations/details/" + code + "   " + name, "", "Villa Zen'O Palmeraie", "Logement entier", "", "Arrivée   Départ", a + "   " + d, "", "VOYAGEURS", "2 adultes", "", "CODE DE CONFIRMATION", code, "", "TOTAL (EUR)   900,00 €", "VERSEMENT DE L'HÔTE", "Frais de chambre   800,00 €", "Frais de service hôte   -124,00 €", "VOUS GAGNEZ   676,00 €"].join("\n"),
});
const CANCEL = (code) => ({
  id: "c" + code, from: "Airbnb <automated@airbnb.com>", date: new Date(Date.now() + 1000).toISOString(),
  subject: "Réservation annulée " + code + " (10–14 déc. 2027)",
  body: ["RÉSERVATION ANNULÉE", "https://www.airbnb.fr/hosting/reservations/details/" + code + "   Villa Zen'O Palmeraie", "10–14 déc., 2 voyageurs"].join("\n"),
});

test("2. « Importer depuis Gmail »: created, re-run without duplicate, cancellation → annulé + link off", async () => {
  const mail = [AIRBNB("HMWEB00001", "Claire Exemple", "ven. 10 déc. 2027", "mar. 14 déc. 2027")];
  const b = newBackend({ gmail: mail });
  const A = await admin(b);
  const page = A.page;
  try {
    await page.goto(srv.origin + "/admin/sejours.html");
    b.fault("import-gmail", { delay: 800 });
    await page.click("[data-import]");
    assert.equal(await page.locator("[data-import]").isDisabled(), true, "disabled while importing");
    await page.locator("[data-import-note][data-import-done]").waitFor({ timeout: 30000 });
    assert.match(await page.locator("[data-import-note]").innerText(), /1\sséjour créé · 0\smis à jour · 0\sannulé/);
    await shot(page, "func-2-import.png");
    assert.equal(b.stayRow("HMWEB00001").nom, "Claire Exemple");
    await page.click("[data-import]");
    await page.waitForFunction(() => /0\sséjour créé/.test(document.querySelector("[data-import-note]").textContent), null, { timeout: 30000 });
    assert.equal(b.box.sheets["Réservations"].rows.filter((r) => r[0] === "HMWEB00001").length, 1, "no duplicate");
    mail.push(CANCEL("HMWEB00001"));
    await page.click("[data-import]");
    await page.waitForFunction(() => /1\sannulé/.test(document.querySelector("[data-import-note]").textContent), null, { timeout: 30000 });
    assert.equal(b.stayRow("HMWEB00001").statut, "annulée");
    assert.equal(b.stayRow("HMWEB00001").lien_actif, false);
    await shot(page, "func-2-import-annulation.png");
    // The cancelled stay's guest link is refused.
    const G = await phone(srv.origin, b);
    await G.page.goto(srv.origin + "/guest/demandes.html?stay=HMWEB00001&k=" + b.keyOf("HMWEB00001"));
    await G.page.waitForURL(/expire\.html/, { timeout: 20000 });
    await shot(G.page, "func-2-lien-annule.png");
    await G.ctx.close();
    assert.equal(b.box.calls.triggers, undefined, "no trigger");
  } finally { await A.ctx.close(); }
});

test("3. free stay: 0 € accepted at creation, shown « Offert »", async () => {
  const b = newBackend();
  const A = await admin(b);
  const page = A.page;
  try {
    await page.goto(srv.origin + "/admin/nouveau.html");
    await page.fill("[name='nom']", "Famille Invitée");
    await page.fill("[name='telephone']", "+33 6 00 00 00 98");
    await setField(page, "[name='arrival']", day(20));
    await setField(page, "[name='departure']", day(24));
    await page.click("[data-source='Direct']");
    await page.fill("[name='tarif']", "0");
    await page.click("[data-save]");
    await page.locator(".form-ok").waitFor({ timeout: 20000 });
    await page.waitForURL(/(sejour|email)\.html\?id=/, { timeout: 20000 });
    const id = new URL(page.url()).searchParams.get("id");
    const row = b.stayRow(id);
    assert.equal(row.direct_tarif, 0);
    assert.equal(row.sejour_offert, true);
    await page.goto(srv.origin + "/admin/sejour.html?id=" + id);
    await page.locator("[data-free-chip]").waitFor({ timeout: 20000 });
    assert.match(await page.locator("[data-free-stay]").innerText(), /Offert/);
    await shot(page, "func-3-sejour-offert.png");
    // Empty amount is still refused (only a typed 0 is « Offert »).
    await page.goto(srv.origin + "/admin/nouveau.html");
    await page.fill("[name='nom']", "Sans Montant");
    await page.fill("[name='telephone']", "+33 6 00 00 00 97");
    await setField(page, "[name='arrival']", day(30));
    await setField(page, "[name='departure']", day(32));
    await page.click("[data-source='Direct']");
    await page.click("[data-save]");
    assert.match(await page.locator("[data-error]").innerText(), /Indiquez le tarif total/);
  } finally { await A.ctx.close(); }
});

test("4. stay edit end to end: dates, adults / 4–11 / under 4, amount → Sheet, admin, guest link", async () => {
  const b = newBackend();
  const A = await admin(b);
  const page = A.page;
  try {
    await page.goto(srv.origin + "/admin/nouveau.html?id=" + b.STAY_ID);
    await page.locator("main h1:has-text('Modifier la réservation')").waitFor({ timeout: 20000 });
    await setField(page, "[name='departure']", day(10));
    await page.click("[data-step='adults'][data-dir='1']");
    await page.click("[data-step='kids4to11'][data-dir='1']");
    await page.click("[data-step='kidsUnder4'][data-dir='1']");
    await page.fill("[name='room']", "1500");
    await shot(page, "func-4-modifier.png");
    await page.click("[data-save]");
    await page.locator(".form-ok").waitFor({ timeout: 20000 });
    const row = b.stayRow(b.STAY_ID);
    assert.deepEqual([row.date_depart, row.adultes, row.enfants_4_11, row.enfants_moins_4, row.enfants, row.airbnb_frais_chambre, row.lien_expire_le],
      [day(10), 3, 1, 1, 2, 1500, day(13)]);
    assert.equal(b.box.sheets["Réservations"].rows.filter((r) => r[0] === b.STAY_ID).length, 1, "same row");
    await page.waitForURL(/sejour\.html/, { timeout: 20000 });
    await page.locator(".meta-line").nth(1).waitFor();
    assert.match(await page.locator("[data-fiche]").innerText(), /3 adultes · 1 enfant 4–11 ans · 1 moins de 4 ans/);
    // Guest side: new departure, prefilled guests on the meal page.
    const G = await phone(srv.origin, b);
    await G.page.goto(srv.origin + "/guest/?stay=" + b.STAY_ID + "&k=" + b.key);
    await stayReady(G.page);
    const dates = await G.page.locator(".stay-range time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")));
    assert.equal(dates[1], day(10));
    await G.page.goto(srv.origin + "/guest/restauration.html");
    await stayReady(G.page);
    await G.page.locator("[data-guests-summary]:not([hidden])").waitFor({ timeout: 10000 });
    assert.equal(await G.page.locator("[data-guests-text]").innerText(), "3 adultes · 1 enfant · 1 bébé");
    await G.ctx.close();
  } finally { await A.ctx.close(); }
});

test("5. restauration: prefilled guests on the 3 meals, counters, extras, no-egg switch, total, new texts; staff summary without price", async () => {
  const b = newBackend();
  b.box.sheets["Réservations"].rows[1][b.box.sheets["Réservations"].rows[0].indexOf("enfants")] = 2;
  const head = b.box.sheets["Réservations"].rows[0];
  b.box.sheets["Réservations"].rows[1].length = head.length;
  b.box.ctx.reservationsSheet_(true); // adds enfants_4_11 / enfants_moins_4
  const h2 = b.box.sheets["Réservations"].rows[0];
  b.box.sheets["Réservations"].rows[1][h2.indexOf("enfants_4_11")] = 1;
  b.box.sheets["Réservations"].rows[1][h2.indexOf("enfants_moins_4")] = 1;
  const G = await phone(srv.origin, b);
  const page = G.page;
  try {
    await page.goto(srv.origin + "/guest/?stay=" + b.STAY_ID + "&k=" + b.key);
    await stayReady(page);
    await page.goto(srv.origin + "/guest/restauration.html");
    await stayReady(page);
    for (const meal of ["lunch", "dinner", "breakfast"]) {
      await page.click("[data-meal='" + meal + "']");
      await page.locator("[data-guests-summary]:not([hidden])").waitFor({ timeout: 10000 });
      assert.equal(await page.locator("[data-guests-text]").innerText(), "2 adultes · 1 enfant · 1 bébé", meal + ": prefilled");
      assert.equal(await page.locator("[data-guests-counters]").isHidden(), true, meal + ": counters behind « Modifier »");
    }
    // Breakfast opens on « Inclus », without « Fruits frais ».
    assert.equal(await page.locator("[data-bf-tab='inclus']").getAttribute("aria-selected"), "true");
    assert.doesNotMatch(await page.locator("[data-bf-panel='inclus']").innerText(), /Fruits frais/);
    assert.equal((await page.locator(".meal-send").innerText()).trim(), "Envoyer ma demande");
    assert.equal((await page.locator(".bf-cash").innerText()).trim(), "Rien à payer maintenant : réglé en espèces à votre départ.");
    await shot(page, "func-5-petit-dej-inclus.png");
    // « Modifier » opens the 3 counters.
    await page.click("[data-guests-edit]");
    assert.equal(await page.locator("[data-guests-counters]").isVisible(), true);
    assert.match(await page.locator("[data-guests-counters]").innerText(), /Adultes[\s\S]*4–11 ans[\s\S]*−50\s%[\s\S]*Moins de 4 ans[\s\S]*offert/);
    await shot(page, "func-5-convives-modifier.png");
    // Extras: fruit bowl 15 € per table, tajine eggs 5 €/person.
    await page.click("[data-bf-tab='supplements']");
    await page.click("[data-extra='fruit_bowl']");
    await page.click("[data-extra-step='tajine'][data-dir='1']");
    await page.click("[data-extra-step='tajine'][data-dir='1']");
    // 2 × 10 + 1 × 5 (4–11) + 0 (under 4) + 15 + 2 × 5 = 50 €
    assert.match(await page.locator("[data-meal-total]").innerText(), /Total estimé · 50\s€/);
    await shot(page, "func-5-supplements.png");
    await setField(page, "[name='date']", day(1));
    await page.selectOption("[name='time']", "10:00");
    // Sent without eggs: switch to « Vos œufs » once.
    await page.click(".meal-send");
    assert.equal(await page.locator("[data-bf-tab='oeufs']").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("[data-bf-panel='oeufs']").isVisible(), true);
    assert.match(await page.locator("[data-meal-form] [data-errors]").innerText(), /Choisissez vos œufs/);
    await shot(page, "func-5-vos-oeufs.png");
    const before = b.demandes().length;
    await page.click("[data-egg='brouille'][data-dir='1']");
    await page.click(".meal-send");
    await page.locator("[data-send-status].is-ok").waitFor({ timeout: 20000 });
    await shot(page, "func-5-demande-recue.png");
    assert.equal(b.demandes().length, before + 1);
    const row = b.demandes()[b.demandes().length - 1];
    assert.equal(row.total_dh, 50);
    assert.deepEqual([row.details.adults, row.details.enfants_4_11, row.details.enfants_moins_4], [2, 1, 1]);
    assert.deepEqual(row.details.extras, { fruit_bowl: true, tajine_eggs: 2 });
    assert.equal(row.details.children_ages, undefined);
    assert.doesNotMatch(row.details.resume, /€|DH|\b15\b|\b50\b/, "staff summary has no price");
    assert.match(row.details.resume, /Coupe de fruits frais : 1/);
    assert.match(row.details.resume, /Œufs façon tajine : 2/);
    const confirm = await page.locator("[data-confirm-list]").innerText();
    assert.match(confirm, /Coupe de fruits frais[\s\S]*15\s€/);
    assert.match(confirm, /Œufs façon tajine[\s\S]*10\s€/);
    assert.deepEqual(G.errors, []);
  } finally { await G.ctx.close(); }
});

test("5. home: renamed tiles (verb + object), Wi-Fi & TV and Loisirs cards, « Mehdi » in the bottom bar; placeholder pages without streaming credentials", async () => {
  const b = newBackend();
  const G = await phone(srv.origin, b);
  const page = G.page;
  try {
    await page.goto(srv.origin + "/guest/?stay=" + b.STAY_ID + "&k=" + b.key);
    await stayReady(page);
    const tiles = await page.locator(".services .tile").evaluateAll((els) => els.map((e) => e.querySelector("h3").textContent + " · " + e.querySelector("p").textContent));
    assert.deepEqual(tiles, ["Transfert · Réserver un chauffeur", "Restauration · Commander un repas", "Massages & soins · Réserver un soin", "Expériences · Réserver une activité",
      "Piscine & jacuzzi · Demander l’entretien", "Services · Demander le ménage", "Marrakech · Découvrir nos adresses", "La Villa · Consulter le guide"]);
    const cards = await page.locator(".home-cards .tile").evaluateAll((els) => els.map((e) => e.querySelector("h3").textContent + " · " + e.querySelector("p").textContent));
    assert.deepEqual(cards, ["Wi-Fi & TV · Se connecter", "Loisirs · Profiter des jeux"]);
    const mehdi = page.locator(".bottom-nav [data-guest-whatsapp]");
    assert.equal((await mehdi.innerText()).trim(), "Mehdi");
    assert.equal(await mehdi.getAttribute("aria-label"), "Écrire à Mehdi, votre hôte, sur WhatsApp");
    assert.equal(await mehdi.locator("svg").count(), 1, "WhatsApp icon kept");
    assert.equal(await page.locator(".mehdi-card, [data-mehdi-card]").count(), 0, "no Mehdi card");
    await shot(page, "func-5-accueil.png");
    await page.goto(srv.origin + "/guest/wifi.html");
    const wifi = await page.locator("main").innerText();
    assert.match(wifi, /Wi-Fi & TV[\s\S]*Sono Bose[\s\S]*IPTV[\s\S]*Netflix[\s\S]*Prime/);
    assert.doesNotMatch(wifi, /mot de passe netflix|identifiant\s*:|login\s*:/i);
    await shot(page, "func-5-wifi-tv.png");
    await page.goto(srv.origin + "/guest/loisirs.html");
    assert.match(await page.locator("main").innerText(), /Baby-foot[\s\S]*Ping-pong[\s\S]*PS5[\s\S]*Jeux de société[\s\S]*Livres[\s\S]*Game Boy[\s\S]*Tapis de yoga/);
    await shot(page, "func-5-loisirs.png");
    // Another page: the shared bottom bar says « Mehdi » too.
    await page.goto(srv.origin + "/guest/menage.html");
    assert.equal((await page.locator(".bottom-nav [data-guest-whatsapp]").innerText()).trim(), "Mehdi");
    assert.equal((await page.locator("h1").innerText()).trim(), "Services");
  } finally { await G.ctx.close(); }
});

test("6. « Famille Démo » (staging seed): guest link works with prefilled guests, admin Stats ignore it", async () => {
  const b = newBackend({ props: { STAGING: "true" } });
  const seed = b.box.ctx.seedDemoStay_();
  assert.equal(seed.ok, true);
  const G = await phone(srv.origin, b);
  try {
    await G.page.goto(srv.origin + "/guest/?stay=FAMDEMO2812&k=" + b.keyOf("FAMDEMO2812"));
    await stayReady(G.page);
    assert.match(await G.page.locator(".stay-card h1").innerText(), /Marhaba Famille,/);
    const dates = await G.page.locator(".stay-range time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")));
    assert.deepEqual(dates, ["2028-12-01", "2028-12-15"]);
    await shot(G.page, "func-6-famille-demo.png");
    // Local server = localhost: the production /exec is used (mocked).
    assert.equal(await G.page.evaluate(() => window.VZApi.urlReady.then((u) => u === window.VZApi.PROD_URL)), true);
  } finally { await G.ctx.close(); }
  const A = await admin(b);
  try {
    await A.page.goto(srv.origin + "/admin/stats.html");
    await A.page.waitForTimeout(2500);
    const statsCalls = b.log.filter((e) => e.action === "stays-stats" && e.answer);
    assert.ok(statsCalls.length >= 1);
    assert.equal(statsCalls[statsCalls.length - 1].answer.stays.some((s) => s.id === "FAMDEMO2812"), false);
  } finally { await A.ctx.close(); }
});

// Review 2026-11-27 (screenshots): text drawn over text on admin cards, raw
// labels (« Menage · maison », « Transfert · departure »), meal price shown
// /10 (« 5 € · 50 DH » for 50 €). On iPhone 16 and iPhone SE sizes.
const { layoutProblems } = require("./layout");
for (const [size, viewport] of [["iPhone 16", { width: 393, height: 852 }], ["iPhone SE", { width: 375, height: 667 }]]) {
  test("review fixes (" + size + "): no overlapping text on Demandes / Aujourd'hui / Encaissement, French labels, meal price in €", async () => {
    const b = newBackend({ latency: [0, 0], realDemandes: 0 });
    const dem = (id, service, sous, details, total, statut, conf) => [id, new Date().toISOString(), service, sous, "Invité", JSON.stringify(Object.assign({ booking_id: b.STAY_ID, token: "t" + id }, details)), total, "Hicham", statut, conf || "", false];
    for (const r of [
      dem("rv1", "transfert", "départ", { trip_type: "departure", date: day(1), pickup_time: "08:00" }, 350, "Confirmée", day(0) + " 09:12"),
      dem("rv2", "menage", "maison", { date: day(0), time: "10:00" }, "", "Confirmée", day(0) + " 09:13"),
      dem("rv3", "activites", "quad", { date: day(2), time: "14:30", adults: 1 }, 300, "Envoyée"),
      dem("rv4", "massage", "decouverte", { date: day(0), time: "11:00" }, 300, "Confirmée", day(0) + " 09:14"),
      dem("rv5", "restauration", "breakfast", { meal: "breakfast", date: day(0), time: "10:00", adults: 2, enfants_4_11: 1, enfants_moins_4: 1, extras: { fruit_bowl: true, tajine_eggs: 2 } }, 50, "Confirmée", day(0) + " 09:15"),
    ]) addDemande(b, r);
    const A = await admin(b);
    await A.page.setViewportSize(viewport);
    try {
      await A.page.goto(srv.origin + "/admin/demandes.html");
      await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
      await A.page.click("[data-filter='toutes']");
      await A.page.locator("[data-open='rv5']").waitFor();
      assert.deepEqual(await layoutProblems(A.page, "main"), [], "Demandes");
      const titles = await A.page.locator("[data-list] .req-title").allInnerTexts();
      for (const t of ["Transfert · départ", "Ménage · toute la maison", "Activités · quad", "Massage découverte", "Restauration · petit-déjeuner"]) assert.ok(titles.indexOf(t) >= 0, t + " in " + JSON.stringify(titles));
      assert.match(await A.page.locator("[data-open='rv5']").innerText(), /50\s€ · 500\sDH/);
      assert.match(await A.page.locator("[data-open='rv1']").innerText(), /35\s€ · 350\sDH/);
      await shot(A.page, "func-review-demandes-" + viewport.width + ".png");
      await A.page.goto(srv.origin + "/admin/aujourdhui.html");
      await A.page.locator("[data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
      assert.deepEqual(await layoutProblems(A.page, "main"), [], "Aujourd'hui");
      await A.page.goto(srv.origin + "/admin/encaissement.html?sejour=" + b.STAY_ID);
      await A.page.locator("[data-cash] [data-sync] [data-refresh]:not([disabled])").waitFor({ timeout: 20000 });
      assert.deepEqual(await layoutProblems(A.page, "main"), [], "Encaissement");
    } finally { await A.ctx.close(); }
  });
}
