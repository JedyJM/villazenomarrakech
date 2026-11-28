// Audit design 2026-11-28 — static checks (no browser).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("audit 28/11 point 5: every guest page turns off iOS phone-number detection", () => {
  const pages = fs.readdirSync(path.join(root, "guest")).filter((f) => f.endsWith(".html")).map((f) => "guest/" + f)
    .concat(fs.readdirSync(path.join(root, "guest/en")).filter((f) => f.endsWith(".html")).map((f) => "guest/en/" + f));
  for (const name of ["acces", "confirmation", "demandes", "expire", "recap"]) assert.ok(pages.includes("guest/" + name + ".html"), name);
  for (const p of pages) {
    const head = read(p).split("</head>")[0];
    assert.match(head, /<meta name="format-detection" content="telephone=no">/, p);
  }
});
