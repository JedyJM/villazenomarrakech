// node --test tests/  — guest link key (point 1) and link expiry (point 4).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { makeSandbox, out } = require("./gas-harness");

const SECRET = "test-secret-not-real-0123456789abcdef";
const RES_HEADERS = ["booking_id", "nom", "date_arrivee", "date_depart", "bien", "origine", "lien_actif", "lien_expire_le", "adultes"];
const DEM_HEADERS = ["id", "date_creation", "service", "sous_type", "nom_client", "details_json", "total_dh", "destinataire", "statut", "date_confirmation", "offert"];

function keyOf(id, secret) {
  return crypto.createHmac("sha256", secret || SECRET).update(id, "utf8").digest("hex").slice(0, 16);
}

function sandbox(extra) {
  extra = extra || {};
  const box = makeSandbox({
    now: extra.now || "2026-11-25T10:00:00Z",
    props: Object.assign({ LINK_SECRET: SECRET }, extra.props || {}),
    sheets: {
      "Réservations": [RES_HEADERS].concat(extra.stays || [
        ["FAM-SK-2611", "Samiya Kabbaj", "2026-11-27", "2026-12-02", "Villa Zen'O", "gmail", true, "", 2],
        ["HMABC123", "Jean Dupont", "2026-11-20", "2026-11-28", "", "gmail", "", "", 2],
        ["OTHER1", "Autre Bien", "2026-11-20", "2026-11-28", "M avenue", "gmail", "", "", 2],
        ["tst0000001", "Test Row", "2026-11-20", "2026-11-28", "", "test", "", "", 2],
      ]),
      Demandes: [DEM_HEADERS,
        ["d1", "2026-11-24T10:00:00Z", "menage", "maison", "Invité", JSON.stringify({ booking_id: "HMABC123", token: "tok1234567", date: "2026-11-26" }), "", "Nadera", "Envoyée", "", false],
        ["d2", "2026-11-24T10:00:00Z", "menage", "maison", "Invité", JSON.stringify({ booking_id: "FAM-SK-2611", token: "tok7654321" }), "", "Nadera", "Envoyée", "", false],
      ],
    },
  });
  box.wa = 0;
  box.ctx.waNotifyStaff_ = () => { box.wa++; };
  box.ctx.notifyNewDemande_ = () => { box.mail = (box.mail || 0) + 1; };
  return box;
}

function list(box, stay, k) {
  const p = { action: "list" };
  if (stay != null) p.stay = stay;
  if (k != null) p.k = k;
  return out(box.ctx.doGet({ parameter: p }));
}
function post(box, body) {
  return out(box.ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
}
const NEUTRAL = { ok: false, error: "invalid_link" };

test("good key: stay info and only this stay's demandes", () => {
  const box = sandbox();
  const r = list(box, "HMABC123", keyOf("HMABC123"));
  assert.equal(r.ok, true);
  assert.equal(r.stay.prenom, "Jean");
  assert.equal(r.stay.arrival, "2026-11-20");
  assert.deepEqual(r.items.map((i) => i.id), ["d1"]);
  assert.equal(JSON.stringify(r).includes("tok1234567"), false, "confirmation token never listed");
  assert.equal("k" in r.stay, false, "no key in public answers");
});

test("key is case-insensitive hex, 16 chars", () => {
  const box = sandbox();
  assert.equal(box.ctx.linkKey_("HMABC123"), keyOf("HMABC123"));
  assert.equal(list(box, "HMABC123", keyOf("HMABC123").toUpperCase()).ok, true);
});

test("wrong key, missing key, empty key, unknown id, no stay, other property: same neutral answer", () => {
  const box = sandbox();
  const answers = [
    list(box, "HMABC123", "0000000000000000"),
    list(box, "HMABC123", keyOf("HMABC123").slice(0, 15)),
    list(box, "HMABC123", keyOf("HMABC123") + "0"),
    list(box, "HMABC123"),
    list(box, "HMABC123", ""),
    list(box, "NOPE999", "0000000000000000"),
    list(box, "NOPE999", keyOf("NOPE999")), // valid key, unknown id
    list(box, "OTHER1", keyOf("OTHER1")), // not Villa Zen'O
    list(box),
    list(box, "", ""),
  ];
  for (const a of answers) assert.deepEqual(a, NEUTRAL);
});

test("key from another secret is refused", () => {
  const box = sandbox();
  assert.deepEqual(list(box, "HMABC123", keyOf("HMABC123", "other-secret")), NEUTRAL);
});

test("legacy-open id works without k; others stay strict", () => {
  const box = sandbox({ props: { LINK_LEGACY_OPEN: " XYZ , FAM-SK-2611 " } });
  const r = list(box, "FAM-SK-2611");
  assert.equal(r.ok, true);
  assert.equal(r.stay.prenom, "Samiya");
  assert.deepEqual(r.items.map((i) => i.id), ["d2"]);
  assert.equal(list(box, "FAM-SK-2611", "garbage").ok, true);
  assert.deepEqual(list(box, "HMABC123"), NEUTRAL);
  // Removed from the property: the old link is closed.
  box.props.LINK_LEGACY_OPEN = "XYZ";
  assert.deepEqual(list(box, "FAM-SK-2611"), NEUTRAL);
  assert.equal(list(box, "FAM-SK-2611", keyOf("FAM-SK-2611")).ok, true);
});

test("LINK_SECRET is generated once and stored in Script properties", () => {
  const box = makeSandbox({ props: {}, sheets: {} });
  const k1 = box.ctx.linkKey_("A1");
  assert.match(box.props.LINK_SECRET, /^[0-9a-f]{64}$/);
  assert.equal(box.calls.setProperty, 1);
  assert.equal(box.ctx.linkKey_("A1"), k1);
  assert.equal(box.calls.setProperty, 1);
  assert.match(k1, /^[0-9a-f]{16}$/);
});

test("safeEqual_", () => {
  const { ctx } = makeSandbox({ sheets: {} });
  assert.equal(ctx.safeEqual_("abc", "abc"), true);
  assert.equal(ctx.safeEqual_("abc", "abd"), false);
  assert.equal(ctx.safeEqual_("abc", "abcd"), false);
  assert.equal(ctx.safeEqual_("", "a"), false);
  assert.equal(ctx.safeEqual_(null, ""), true);
});

test("admin (Google session) gets k on stays and stay; token=test only on test rows", () => {
  const box = sandbox();
  box.ctx.adminCheck_ = (t) => (t === "good-google-token" ? { email: "a@b.c", error: "" } : { email: "", error: "invalid_token" });
  const all = out(box.ctx.doGet({ parameter: { action: "stays", token: "good-google-token" } }));
  assert.equal(all.ok, true);
  const byId = Object.fromEntries(all.stays.map((s) => [s.id, s]));
  assert.equal(byId["HMABC123"].k, keyOf("HMABC123"));
  assert.equal(byId["FAM-SK-2611"].k, keyOf("FAM-SK-2611"));
  const one = out(box.ctx.doGet({ parameter: { action: "stay", id: "HMABC123", token: "good-google-token" } }));
  assert.equal(one.stay.k, keyOf("HMABC123"));
  const t = out(box.ctx.doGet({ parameter: { action: "stays", token: "test", test: "1" } }));
  assert.deepEqual(t.stays.map((s) => s.id), ["tst0000001"]);
  assert.equal(t.stays[0].k, keyOf("tst0000001"));
  const none = out(box.ctx.doGet({ parameter: { action: "stays", token: "forged" } }));
  assert.deepEqual(none, { ok: false, error: "forbidden" });
});

function demande(extra) {
  return Object.assign({
    id: "n" + Math.random().toString(36).slice(2, 9), token: "abcdefghij", service: "menage", sous_type: "maison",
    nom_client: "Invité", details: { booking_id: "HMABC123", date: "2026-11-26" }, total_dh: "", destinataire: "Nadera",
  }, extra);
}

test("guest POST without k / wrong k / unknown id: refused, no row, no WhatsApp, no e-mail", () => {
  const box = sandbox();
  const before = box.sheets.Demandes.getLastRow();
  for (const body of [
    demande(),
    demande({ k: "0000000000000000" }),
    demande({ stay: "HMABC123", k: "" }),
    demande({ details: { booking_id: "NOPE999" }, k: keyOf("NOPE999") }),
    demande({ details: {} }),
    // key of one stay, booking_id of another
    demande({ stay: "HMABC123", k: keyOf("FAM-SK-2611") }),
  ]) assert.deepEqual(post(box, body), NEUTRAL);
  assert.equal(box.sheets.Demandes.getLastRow(), before);
  assert.equal(box.wa, 0);
  assert.equal(box.mail || 0, 0);
});

test("guest POST with valid k: row written for the checked stay, WhatsApp called once", () => {
  const box = sandbox();
  const r = post(box, demande({ id: "okreq01", stay: "HMABC123", k: keyOf("HMABC123"), details: { booking_id: "FAM-SK-2611" } }));
  assert.deepEqual(r, { ok: true });
  const last = box.sheets.Demandes.rows[box.sheets.Demandes.rows.length - 1];
  assert.equal(last[0], "okreq01");
  assert.equal(JSON.parse(last[5]).booking_id, "HMABC123", "booking_id forced to the checked stay");
  assert.equal(box.wa, 1);
});

test("guest POST for a legacy-open id without k is accepted", () => {
  const box = sandbox({ props: { LINK_LEGACY_OPEN: "FAM-SK-2611" } });
  assert.deepEqual(post(box, demande({ id: "legacy1", details: { booking_id: "FAM-SK-2611" } })), { ok: true });
  assert.equal(box.wa, 1);
});

module.exports = { sandbox, keyOf, list, post, demande, NEUTRAL, RES_HEADERS };

// ---------- Point 4: lien_actif / lien_expire_le on the server ----------
function oneStay(row, now) {
  return sandbox({ now: now || "2026-11-25T10:00:00Z", stays: [row] });
}
const EXPIRED = { ok: false, error: "expired" };

test("active link (departure in the future): OK", () => {
  const box = oneStay(["S1", "A B", "2026-11-20", "2026-11-28", "", "", true, "", 2]);
  assert.equal(list(box, "S1", keyOf("S1")).ok, true);
});

test("lien_actif false / 'non' / 0: expired, no data, POST refused", () => {
  for (const off of [false, "non", "false", 0, "0"]) {
    const box = oneStay(["S1", "A B", "2026-11-20", "2026-11-28", "", "", off, "", 2]);
    assert.deepEqual(list(box, "S1", keyOf("S1")), EXPIRED, String(off));
    assert.deepEqual(post(box, demande({ stay: "S1", k: keyOf("S1"), details: { booking_id: "S1" } })), EXPIRED);
    assert.equal(box.wa, 0);
  }
});

test("lien_actif empty = active (rows from before the column)", () => {
  const box = oneStay(["S1", "A B", "2026-11-20", "2026-11-28", "", "", "", "", 2]);
  assert.equal(list(box, "S1", keyOf("S1")).ok, true);
});

test("past lien_expire_le: expired; wrong key on an expired link stays neutral", () => {
  const box = oneStay(["S1", "A B", "2026-11-01", "2026-11-05", "", "", true, "2026-11-24", 2]);
  assert.deepEqual(list(box, "S1", keyOf("S1")), EXPIRED);
  assert.deepEqual(list(box, "S1", "bad"), NEUTRAL);
});

test("lien_expire_le overrides departure + 3 (prolonged link)", () => {
  const box = oneStay(["S1", "A B", "2026-11-01", "2026-11-05", "", "", true, "2026-12-01", 2]);
  assert.equal(list(box, "S1", keyOf("S1")).ok, true);
});

test("no lien_expire_le: departure + 3 days, limit day included", () => {
  // departure 2026-11-22 -> open through 2026-11-25 (today), closed on the 26th.
  const row = ["S1", "A B", "2026-11-18", "2026-11-22", "", "", true, "", 2];
  // "Today" comes from Utilities.formatDate(now, "Africa/Casablanca").
  assert.equal(list(oneStay(row, "2026-11-25T21:00:00Z"), "S1", keyOf("S1")).ok, true, "evening of the last day");
  assert.deepEqual(list(oneStay(row, "2026-11-26T03:00:00Z"), "S1", keyOf("S1")), EXPIRED, "early morning, next day");
  assert.deepEqual(list(oneStay(row, "2026-11-27T10:00:00Z"), "S1", keyOf("S1")), EXPIRED);
});

test("explicit lien_expire_le limit day included (Date cell)", () => {
  const row = ["S1", "A B", "2026-11-18", "2026-11-22", "", "", true, new Date("2026-11-25T12:00:00Z"), 2];
  assert.equal(list(oneStay(row, "2026-11-25T20:00:00Z"), "S1", keyOf("S1")).ok, true);
  assert.deepEqual(list(oneStay(row, "2026-11-26T08:00:00Z"), "S1", keyOf("S1")), EXPIRED);
});

test("departure day itself (portal 'closed'): server still open", () => {
  const box = oneStay(["S1", "A B", "2026-11-20", "2026-11-25", "", "", true, "", 2]);
  assert.equal(list(box, "S1", keyOf("S1")).ok, true);
});

test("no dates at all: open (same as the portal)", () => {
  const box = oneStay(["S1", "A B", "", "", "", "", "", "", 2]);
  assert.equal(list(box, "S1", keyOf("S1")).ok, true);
});

test("legacy-open id still obeys expiry", () => {
  const box = sandbox({ props: { LINK_LEGACY_OPEN: "S1" }, stays: [["S1", "A B", "2026-11-01", "2026-11-05", "", "", true, "", 2]] });
  assert.deepEqual(list(box, "S1"), EXPIRED);
});

test("linkExpired_ pure helper", () => {
  const { ctx } = makeSandbox({ sheets: {} });
  assert.equal(ctx.linkExpired_({ departure: "2026-12-30", lien_actif: true }, "2027-01-02"), false);
  assert.equal(ctx.linkExpired_({ departure: "2026-12-30", lien_actif: true }, "2027-01-03"), true);
  assert.equal(ctx.linkExpired_({ departure: "2028-02-27" }, "2028-03-01"), false, "leap year");
  assert.equal(ctx.linkExpired_({ departure: "2028-02-27" }, "2028-03-02"), true);
  assert.equal(ctx.linkExpired_({ departure: "27/11/2026", lien_expire_le: "" }, "2030-01-01"), false, "unreadable date = open");
});
