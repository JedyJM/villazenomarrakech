#!/usr/bin/env node
// npm run e2e — LEVEL 2 suite (TESTS-E2E.md) on iPhone 16 size then iPhone SE.
// Local by default (mocked /exec, real script logic). Against staging:
//   E2E_BASE_URL=<Vercel preview> E2E_EXEC_URL=<staging /exec> E2E_ADMIN_TOKEN=<token> [E2E_GUEST_K=<key>] npm run e2e
// Screenshots: staging E2E_SHOTS/<device>/<step>.png; local always tests/e2e/out/<device>/
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
let pass = 0, fail = 0;
const failed = [];
const blocked = new Set();
for (const device of (process.env.E2E_DEVICES || "16,se").split(",")) {
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-timeout=240000", "--test-reporter=tap", "tests/e2e/staging.e2e.test.js"], {
    cwd: root, env: Object.assign({}, process.env, { E2E_DEVICE: device }), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 3000000, killSignal: "SIGKILL",
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const p = Number((out.match(/^# pass (\d+)/m) || [])[1] || 0);
  const f = Number((out.match(/^# fail (\d+)/m) || [])[1] || 0) + Number((out.match(/^# cancelled (\d+)/m) || [])[1] || 0);
  pass += p; fail += f;
  console.log(("iPhone " + device).padEnd(14) + " pass " + String(p).padStart(3) + "  fail " + String(f).padStart(3));
  for (const m of out.matchAll(/^not ok \d+ - (.+)$/gm)) failed.push(device + ": " + m[1]);
  for (const m of out.matchAll(/^#?\s*BLOCKED: (.+)$/gm)) blocked.add(device + ": " + m[1]);
  for (const m of out.matchAll(/^#?\s*RESET: (.+)$/gm)) console.log("  reset: " + m[1]);
  if (process.env.E2E_VERBOSE) console.log(out);
}
console.log("TOTAL".padEnd(14) + " pass " + String(pass).padStart(3) + "  fail " + String(fail).padStart(3) + (process.env.E2E_BASE_URL ? "  (staging)" : "  (local, mocked /exec)"));
if (failed.length) console.log("Failed:\n  " + failed.join("\n  "));
if (blocked.size) console.log("Blocked (not proved, missing staging setting):\n  " + Array.from(blocked).join("\n  "));
process.exit(fail ? 1 : 0);
