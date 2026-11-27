// Apps Script /exec URL for a Vercel PREVIEW (staging), read by js/vz-api.js.
// Environment variable (name only, the value is a public /exec URL, not a
// secret): VZ_EXEC_URL, set on the Vercel project for the Preview
// environment only. Production (villazenomarrakech.vercel.app, VERCEL_ENV
// "production") and GitHub Pages (no /api at all) always keep the URL
// written in js/vz-api.js: this function answers {} there.
// Only a https://script.google.com/macros/s/<id>/exec value is accepted.

const EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/;

export function execUrlFor(env) {
  env = env || {};
  if (env.VERCEL_ENV !== "preview") return "";
  const url = String(env.VZ_EXEC_URL || "").trim();
  return EXEC_RE.test(url) ? url : "";
}

export function GET() {
  const url = execUrlFor(process.env);
  return new Response(JSON.stringify(url ? { execUrl: url, env: "staging" } : {}), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
