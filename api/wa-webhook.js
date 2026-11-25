// WhatsApp Cloud API webhook relay for Villa Zen'O.
// Meta needs a direct HTTP 200. Apps Script answers POST with a 302 redirect,
// so this small Vercel function answers Meta and forwards the event to Apps Script.
// Only used on Vercel previews. GitHub Pages (production) never serves /api.
//
// Environment variables (names only, values never in the repo):
//   META_APP_SECRET (or WHATSAPP_APP_SECRET)  Meta app secret. Required:
//       without it every POST gets 503 and nothing is forwarded (fail-closed).
//   WA_FORWARD_SECRET  shared relay secret, sent as "fwd" to Apps Script,
//       which compares it with its Script property WA_FWD_SECRET.
//   WA_FORWARD_URL     optional, overrides the Apps Script /exec URL.

import { createHmac, timingSafeEqual } from "node:crypto";

// Handshake string typed in the Meta dashboard. Not a secret.
const VERIFY_TOKEN = "vzo-wh-7f3c9a1e5b2d48c6a0e4f9b1d3c7e852";

// Same /exec URL as APPS_SCRIPT_URL in guest/js/requests.js.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";

// Time allowed for Apps Script to answer before we give up.
const FORWARD_TIMEOUT_MS = 8000;

// Meta webhook bodies are a few KB; anything bigger is refused.
export const MAX_BODY_BYTES = 256 * 1024;

const SIGNATURE_RE = /^sha256=[0-9a-f]{64}$/;

function text(body, status) {
  return new Response(body, {
    status: status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function appSecret() {
  return process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || "";
}

// Meta subscription check: echo hub.challenge when the token matches.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === VERIFY_TOKEN) {
    return text(params.get("hub.challenge") || "", 200);
  }
  return text("forbidden", 403);
}

// True when X-Hub-Signature-256 is "sha256=<64 hex>" and matches
// HMAC-SHA256(raw body bytes, app secret). Constant-time on equal lengths.
export function signatureOk(rawBytes, header, secret) {
  const given = String(header || "").trim().toLowerCase();
  if (!secret || !SIGNATURE_RE.test(given)) return false;
  const expected = createHmac("sha256", secret).update(rawBytes).digest();
  const a = Buffer.from(given.slice(7), "hex");
  if (a.length !== expected.length) return false;
  return timingSafeEqual(a, expected);
}

// Reads the body as bytes, stopping past MAX_BODY_BYTES (null = too big).
async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch (err) {}
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

// Event delivery: secret configured, size, signature; then forward and answer 200.
export async function POST(request) {
  const secret = appSecret();
  if (!secret) {
    console.error("wa-webhook: META_APP_SECRET / WHATSAPP_APP_SECRET not set, POST refused");
    return text("not configured", 503);
  }

  const raw = await readBody(request);
  if (raw === null) return text("payload too large", 413);

  if (!signatureOk(raw, request.headers.get("x-hub-signature-256"), secret)) {
    console.warn("wa-webhook: bad or missing signature");
    return text("bad signature", 401);
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    return text("ignored", 200);
  }

  // Counts only: payloads contain phone numbers and texts, never log them.
  let statuses = 0;
  let messages = 0;
  for (const entry of (payload && payload.entry) || []) {
    for (const change of (entry && entry.changes) || []) {
      const value = (change && change.value) || {};
      statuses += (value.statuses || []).length;
      messages += (value.messages || []).length;
    }
  }
  console.log("wa-webhook: statuses " + statuses + ", messages " + messages);

  const fwd = process.env.WA_FORWARD_SECRET || "";
  if (!fwd) console.error("wa-webhook: WA_FORWARD_SECRET not set, Apps Script will refuse the event");

  // Await the forward: Vercel freezes the function once the response is sent.
  const target = process.env.WA_FORWARD_URL || APPS_SCRIPT_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "wa-webhook", fwd: fwd, payload: payload }),
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) console.error("wa-webhook: Apps Script answered " + res.status);
  } catch (err) {
    console.error("wa-webhook: forward failed", err && err.name ? err.name : "error");
  } finally {
    clearTimeout(timer);
  }

  // Always 200 after a valid signature so Meta does not retry forever.
  // Apps Script dedupes retries on its side.
  return text("ok", 200);
}
