// Shared helpers: local static server (same rewrites as vercel.json, or
// GitHub Pages mode with 404.html), iPhone 15 WebKit context, the mocked
// /exec, captured wa.me texts, screenshots.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { webkit, devices } = require("playwright");
const { createBackend, ROOT } = require("./backend");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp4": "video/mp4" };
const SHOTS = process.env.VZ_SHOTS || (fs.existsSync("/workspace/shots") ? "/workspace/shots/bugfix" : path.join(__dirname, "out"));
fs.mkdirSync(SHOTS, { recursive: true });

// mode "vercel": /c/:code -> /c/index.html. mode "pages": unknown path -> 404.html (status 404).
function startServer(mode) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      let p = decodeURIComponent(url.pathname);
      if (mode !== "pages" && /^\/c\/[^/]+$/.test(p)) p = "/c/index.html";
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "content-type": TYPES[".html"] });
        return res.end(fs.readFileSync(path.join(ROOT, "404.html")));
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: "http://localhost:" + server.address().port, close: () => new Promise((r) => server.close(r)) }));
  });
}

let browserPromise = null;
function browser() {
  if (!browserPromise) browserPromise = webkit.launch();
  return browserPromise;
}

/* New iPhone 15 context wired to the mocked backend. Returns
   { ctx, page, backend, wa: [urls], errors: [] }. Every request outside
   localhost / the mocked /exec / wa.me is aborted (no network). */
async function phone(origin, backend, opts) {
  opts = opts || {};
  const b = await browser();
  const ctx = await b.newContext(Object.assign({}, devices["iPhone 15"], { locale: "fr-FR", timezoneId: "Africa/Casablanca" }));
  const wa = [];
  const errors = [];
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (url.startsWith("https://script.google.com/macros/")) return backend.route(route);
    if (url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
      wa.push(url);
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa.me (test)</body></html>" });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(String(e && e.message || e))));
  return { ctx, page, backend, wa, errors };
}

function waText(url) {
  const u = new URL(url);
  return u.searchParams.get("text") || "";
}

async function shot(page, name) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function day(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

async function setField(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

module.exports = { startServer, browser, phone, waText, shot, day, setField, createBackend, SHOTS, ROOT };
