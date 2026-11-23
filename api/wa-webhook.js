// WhatsApp Cloud API webhook relay for Villa Zen'O.
// Meta needs a direct HTTP 200. Apps Script answers POST with a 302 redirect,
// so this small Vercel function answers Meta and forwards the event to Apps Script.
// Only used on Vercel previews. GitHub Pages (production) never serves /api.

import { createHmac, timingSafeEqual } from "node:crypto";

// Handshake string typed in the Meta dashboard. Not a secret.
const VERIFY_TOKEN = "vzo-wh-7f3c9a1e5b2d48c6a0e4f9b1d3c7e852";

// Same /exec URL as APPS_SCRIPT_URL in guest/js/requests.js.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";

// Time allowed for Apps Script to answer before we give up.
const FORWARD_TIMEOUT_MS = 8000;

// Warn only once per warm instance when the signature check is off.
let warnedNoSecret = false;

function text(body, status) {
  return new Response(body, {
    status: status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

// Meta subscription check: echo hub.challenge when the token matches.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === VERIFY_TOKEN) {
    return text(params.get("hub.challenge") || "", 200);
  }
  return text("forbidden", 403);
}

// True when X-Hub-Signature-256 matches HMAC-SHA256(raw body, app secret).
function signatureOk(raw, header, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const given = String(header || "");
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Event delivery: check signature, then forward to Apps Script and answer 200.
export async function POST(request) {
  const raw = await request.text();

  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    if (!signatureOk(raw, request.headers.get("x-hub-signature-256"), secret)) {
      return text("bad signature", 401);
    }
  } else if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.warn("wa-webhook: WHATSAPP_APP_SECRET not set, signature check skipped");
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return text("ignored", 200);
  }

  // Counts only: payloads contain phone numbers, never log them in full.
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

  // Await the forward: Vercel freezes the function once the response is sent.
  const target = process.env.WA_FORWARD_URL || APPS_SCRIPT_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "wa-webhook", payload: payload }),
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) console.error("wa-webhook: Apps Script answered " + res.status);
  } catch (err) {
    console.error("wa-webhook: forward failed", err && err.message ? err.message : err);
  } finally {
    clearTimeout(timer);
  }

  // Always 200 after a valid signature so Meta does not retry forever.
  // Apps Script dedupes retries on its side.
  return text("ok", 200);
}
