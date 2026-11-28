#!/usr/bin/env node
// Read-only: is this checkout worth driving? Exit 1 on any problem.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../../..");
const problems = [];
const ok = (m) => console.log("ok   " + m);
const bad = (m) => { problems.push(m); console.log("FAIL " + m); };
ok("node " + process.version);
try {
  const pw = require(path.join(root, "node_modules/playwright/package.json"));
  ok("playwright " + pw.version);
  const { webkit } = require(path.join(root, "node_modules/playwright"));
  fs.existsSync(webkit.executablePath()) ? ok("webkit installed") : bad("webkit missing: npx playwright install webkit");
} catch (e) { bad("playwright not installed: npm install"); }
const code = process.env.VZ_GAS_CODE || "/workspace/sec/Code.v21.gs";
function block(t) { const a = t.indexOf("// BEGIN VZ_FIELDS"), b = t.indexOf("// END VZ_FIELDS"); return a < 0 || b < 0 ? null : t.slice(a, b); }
if (!fs.existsSync(code)) bad("Apps Script file missing: " + code);
else {
  const same = block(fs.readFileSync(code, "utf8")) === block(fs.readFileSync(path.join(root, "js/vz-fields.js"), "utf8"));
  same ? ok("VZ_FIELDS identical in " + path.basename(code) + " and js/vz-fields.js") : bad("VZ_FIELDS differs: copy the js/vz-fields.js block into the script under test");
}
const html = [];
for (const dir of ["guest", "guest/en", "admin", "c"]) for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith(".html")) html.push(path.join(dir, f));
const versions = new Set();
for (const f of html) {
  const t = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of t.matchAll(/(?:src|href)="([^"#]+?\.(?:js|css))(\?v=([0-9a-z]+))?"/g)) {
    if (/^https?:/.test(m[1])) continue;
    if (m[3]) versions.add(m[3]);
    const target = m[1].startsWith("/") ? path.join(root, m[1]) : path.join(root, path.dirname(f), m[1]);
    if (!fs.existsSync(target)) bad(f + " → missing " + m[1]);
  }
}
versions.size === 1 ? ok("one cache-bust ?v=" + [...versions][0]) : bad("several ?v= values: " + [...versions].join(", "));
process.exit(problems.length ? 1 : 0);
