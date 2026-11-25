// node --test tests/  — api/wa-webhook.js (point 2). Test secrets only.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { GET, POST, MAX_BODY_BYTES } from "../api/wa-webhook.js";

const require = createRequire(import.meta.url);
const { makeSandbox, out } = require("./gas-harness.js");

const SECRET = "unit-test-app-secret";
const BODY = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.X", status: "read", recipient_id: "000" }] } }] }] });

function sign(body, secret) {
  return "sha256=" + createHmac("sha256", secret || SECRET).update(body).digest("hex");
}
function req(body, headers) {
  return new Request("https://x.vercel.app/api/wa-webhook", { method: "POST", body, headers: headers || {} });
}
let forwarded = [];
function setup(env) {
  delete process.env.META_APP_SECRET;
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WA_FORWARD_SECRET;
  Object.assign(process.env, env || {});
  forwarded = [];
  globalThis.fetch = async (url, init) => { forwarded.push({ url, body: JSON.parse(init.body) }); return new Response("{}", { status: 200 }); };
}
// Quiet console during tests (the function logs counts only).
for (const k of ["log", "warn", "error"]) console[k] = () => {};

test("valid signature (META_APP_SECRET): 200 and forwarded with fwd", async () => {
  setup({ META_APP_SECRET: SECRET, WA_FORWARD_SECRET: "fwd-test" });
  const res = await POST(req(BODY, { "x-hub-signature-256": sign(BODY) }));
  assert.equal(res.status, 200);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].body.action, "wa-webhook");
  assert.equal(forwarded[0].body.fwd, "fwd-test");
  assert.equal(forwarded[0].body.payload.entry[0].changes[0].value.statuses[0].id, "wamid.X");
});

test("WHATSAPP_APP_SECRET is accepted too; uppercase hex ok", async () => {
  setup({ WHATSAPP_APP_SECRET: SECRET });
  const res = await POST(req(BODY, { "x-hub-signature-256": sign(BODY).toUpperCase().replace("SHA256=", "sha256=") }));
  assert.equal(res.status, 200);
  assert.equal(forwarded.length, 1);
});

test("missing / wrong / wrong-length / malformed signature: 401, nothing forwarded", async () => {
  setup({ META_APP_SECRET: SECRET });
  const bad = [
    undefined,
    "",
    sign(BODY, "other-secret"),
    sign(BODY).slice(0, -2),
    sign(BODY) + "00",
    sign(BODY).replace("sha256=", "sha1="),
    sign(BODY).slice(7),
    "sha256=" + "z".repeat(64),
    sign(BODY + " "),
  ];
  for (const h of bad) {
    const res = await POST(req(BODY, h === undefined ? {} : { "x-hub-signature-256": h }));
    assert.equal(res.status, 401, String(h));
  }
  assert.equal(forwarded.length, 0);
});

test("no secret set: 503 not configured, nothing forwarded (even if signed)", async () => {
  setup({});
  const res = await POST(req(BODY, { "x-hub-signature-256": sign(BODY) }));
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "not configured");
  assert.equal(forwarded.length, 0);
});

test("body over 256 KB: 413, nothing forwarded", async () => {
  setup({ META_APP_SECRET: SECRET });
  const big = "x".repeat(MAX_BODY_BYTES + 1);
  const res = await POST(req(big, { "x-hub-signature-256": sign(big) }));
  assert.equal(res.status, 413);
  assert.equal(forwarded.length, 0);
});

test("GET handshake unchanged", async () => {
  const ok = await GET(new Request("https://x/api/wa-webhook?hub.mode=subscribe&hub.verify_token=vzo-wh-7f3c9a1e5b2d48c6a0e4f9b1d3c7e852&hub.challenge=42"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "42");
  const ko = await GET(new Request("https://x/api/wa-webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"));
  assert.equal(ko.status, 403);
});

// Apps Script side: action=wa-webhook needs fwd === WA_FWD_SECRET.
function gas(props) {
  const box = makeSandbox({ props, sheets: {} });
  box.hits = 0;
  box.ctx.waWebhook_ = () => { box.hits++; return { statuts: 1, messages: 0, confirmees: 0 }; };
  return box;
}
function wa(box, fwd) {
  const body = { action: "wa-webhook", payload: {} };
  if (fwd !== undefined) body.fwd = fwd;
  return out(box.ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
}

test("Code.gs: wa-webhook with the right fwd is processed", () => {
  const box = gas({ WA_FWD_SECRET: "relay-test" });
  assert.equal(wa(box, "relay-test").ok, true);
  assert.equal(box.hits, 1);
});

test("Code.gs: wrong / missing fwd refused; property not set refuses everything", () => {
  const box = gas({ WA_FWD_SECRET: "relay-test" });
  for (const f of [undefined, "", "relay-tes", "relay-test2", null]) assert.deepEqual(wa(box, f), { ok: false, error: "forbidden" });
  const closed = gas({});
  for (const f of [undefined, "", "anything"]) assert.deepEqual(wa(closed, f), { ok: false, error: "forbidden" });
  assert.equal(box.hits + closed.hits, 0);
});
