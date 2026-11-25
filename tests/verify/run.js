#!/usr/bin/env node
// npm run verify — runs EVERYTHING and prints pass / fail counts:
//   1. script tests (gas harness, Code.v19.gs): legacy guest-link + hardening,
//      field model identity, Confirmer repeat open, staff WhatsApp templates;
//   2. Vercel relay test (wa-webhook);
//   3. browser journeys (iPhone 15 WebKit, local server, /exec mocked):
//      guest, admin + link, cross-cutting.
// Env: VZ_GAS_CODE (default /workspace/sec/Code.v19.gs), VZ_SHOTS.
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const root = path.join(__dirname, "..", "..");
const code = process.env.VZ_GAS_CODE || "/workspace/sec/Code.v19.gs";
if (!fs.existsSync(code)) {
  console.error("Missing Apps Script file: " + code + " (set VZ_GAS_CODE). The suite needs Code.v19.gs.");
  process.exit(2);
}
const groups = [
  ["script (Code.v19.gs)", ["tests/guest-link.test.js", "tests/hardening.test.js", "tests/verify/fields.test.js", "tests/verify/gas.test.js"]],
  ["relay (api/wa-webhook.js)", ["tests/wa-webhook.test.mjs"]],
  ["guest journey", ["tests/verify/guest.e2e.test.js"]],
  ["admin journey + link", ["tests/verify/admin.e2e.test.js"]],
  ["cross-cutting", ["tests/verify/cross.e2e.test.js"]],
];
let pass = 0, fail = 0;
const rows = [];
const failed = [];
for (const [name, files] of groups) {
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=tap"].concat(files), {
    cwd: root, env: Object.assign({}, process.env, { VZ_GAS_CODE: code }), encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const p = Number((out.match(/^# pass (\d+)/m) || [])[1] || 0);
  const f = Number((out.match(/^# fail (\d+)/m) || [])[1] || 0) + (r.status && !/^# fail/m.test(out) ? 1 : 0);
  pass += p; fail += f;
  rows.push([name, p, f]);
  for (const m of out.matchAll(/^not ok \d+ - (.+)$/gm)) failed.push(name + ": " + m[1]);
  if (process.env.VZ_VERBOSE || f) process.stdout.write(out.split("\n").filter((l) => /^(not ok|ok|# )|error|expected|actual|Timeout/i.test(l.trim())).slice(0, 200).join("\n") + "\n");
}
console.log("\nVilla Zen'O verification — " + new Date().toISOString());
console.log("Apps Script under test: " + path.basename(code));
for (const [n, p, f] of rows) console.log(("  " + n).padEnd(30) + " pass " + String(p).padStart(3) + "  fail " + String(f).padStart(3));
console.log("TOTAL".padEnd(30) + " pass " + String(pass).padStart(3) + "  fail " + String(fail).padStart(3));
if (failed.length) console.log("Failed:\n  " + failed.join("\n  "));
process.exit(fail ? 1 : 0);
