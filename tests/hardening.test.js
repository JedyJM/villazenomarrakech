// node --test tests/  — point 6 fixes in Code.gs.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSandbox } = require("./gas-harness");
const { sandbox, keyOf, post, demande } = require("./fixtures");

test("sheetSafe_: formulas become text, numbers untouched", () => {
  const { ctx } = makeSandbox({ sheets: {} });
  for (const v of ["=HYPERLINK(\"x\")", "+cmd", "-1+2", "@SUM(A1)", "\t=1", "\r=1", "+33 6 12"]) assert.equal(ctx.sheetSafe_(v), "'" + v);
  for (const v of ["-12", "+3.5", "4,5", "abc", "", "2026-11-25", 12, -3, true, null]) assert.equal(ctx.sheetSafe_(v), v);
});

test("guest POST: formula text in name / sous_type / service / total is stored as text", () => {
  const box = sandbox();
  const r = post(box, demande({ id: "f1", stay: "HMABC123", k: keyOf("HMABC123"), nom_client: "=IMPORTXML(\"http://x\",\"//a\")", sous_type: "@x", service: "+menage", total_dh: "=1+1", destinataire: "-cmd" }));
  assert.equal(r.ok, true);
  const row = box.sheets.Demandes.rows.at(-1);
  assert.equal(row[4], "'=IMPORTXML(\"http://x\",\"//a\")");
  assert.equal(row[3], "'@x");
  assert.equal(row[2], "'+menage");
  assert.equal(row[6], "'=1+1");
  assert.equal(row[7], "'-cmd");
});

test("guest POST rate limit: 30 per stay, then rate_limited, no WhatsApp", () => {
  const box = sandbox();
  for (let i = 0; i < 30; i++) assert.equal(post(box, demande({ id: "r" + i, stay: "HMABC123", k: keyOf("HMABC123") })).ok, true);
  assert.deepEqual(post(box, demande({ id: "r30", stay: "HMABC123", k: keyOf("HMABC123") })), { ok: false, error: "rate_limited" });
  assert.equal(box.wa, 30);
  // duplicates are not counted and other stays are independent
  assert.equal(post(box, demande({ id: "r1", stay: "HMABC123", k: keyOf("HMABC123") })).duplicate, true);
  assert.equal(post(box, demande({ id: "o1", stay: "tst0000001", k: keyOf("tst0000001") })).ok, true);
});

function confirm(box, id, t) {
  return box.ctx.doGet({ parameter: { action: "confirm", id, t } }).html;
}
test("confirm link: constant-time token, wrong token refused, Annulée stays Annulée", () => {
  const box = sandbox();
  assert.match(confirm(box, "d1", "wrongtoken"), /pas valable/);
  assert.match(confirm(box, "d1", "tok123456"), /pas valable/);
  assert.equal(box.sheets.Demandes.rows[1][8], "Envoyée");
  assert.match(confirm(box, "d1", "tok1234567"), /Demande confirm/);
  assert.equal(box.sheets.Demandes.rows[1][8], "Confirmée");
  box.sheets.Demandes.rows[2][8] = "Annulée";
  assert.match(confirm(box, "d2", "tok7654321"), /annul/);
  assert.equal(box.sheets.Demandes.rows[2][8], "Annulée");
});

test("admin routes: forged / empty token and token=test without test=1 are forbidden", () => {
  const box = sandbox();
  box.ctx.adminCheck_ = () => ({ email: "", error: "invalid_token" });
  for (const action of ["stays", "stay", "demandes", "depenses", "get-reglages", "stays-stats"]) {
    for (const p of [{}, { token: "forged" }, { token: "test" }]) {
      const r = JSON.parse(box.ctx.doGet({ parameter: Object.assign({ action }, p) }).text);
      assert.deepEqual(r, { ok: false, error: "forbidden" }, action + JSON.stringify(p));
    }
  }
  for (const action of ["save-stay", "stay-link", "set-demande", "save-depense", "delete-depense", "save-reglages"]) {
    const r = JSON.parse(box.ctx.doPost({ postData: { contents: JSON.stringify({ action, token: "forged" }) } }).text);
    assert.deepEqual(r, { ok: false, error: "forbidden" }, action);
  }
});

test("token=test (test=1): no real stay, no real demande, no writes on real rows", () => {
  const box = sandbox();
  const get = (p) => JSON.parse(box.ctx.doGet({ parameter: Object.assign({ token: "test", test: "1" }, p) }).text);
  assert.deepEqual(get({ action: "stays" }).stays.map((s) => s.id), ["tst0000001"]);
  assert.equal(get({ action: "stay", id: "HMABC123" }).stay, null);
  assert.deepEqual(get({ action: "demandes" }).items, []);
  assert.deepEqual(get({ action: "depenses" }).depenses, []);
  assert.deepEqual(get({ action: "stays-stats" }).stays, []);
  const postT = (b) => JSON.parse(box.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: "test", test: "1" }, b)) } }).text);
  assert.deepEqual(postT({ action: "set-demande", id: "d1", statut: "Annulée" }), { ok: false, error: "forbidden" });
  assert.deepEqual(postT({ action: "stay-link", id: "HMABC123", op: "deactivate" }), { ok: false, error: "forbidden" });
  assert.deepEqual(postT({ action: "save-stay", stay: { booking_id: "HMABC123", nom: "x" } }), { ok: false, error: "forbidden" });
  for (const action of ["save-depense", "delete-depense", "save-reglages"]) assert.deepEqual(postT({ action }), { ok: false, error: "forbidden" });
  assert.equal(box.sheets.Demandes.rows[1][8], "Envoyée");
});
