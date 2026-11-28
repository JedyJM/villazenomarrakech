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

test("audit 28/11 point 4: French contacts match the validated mock (no landline hint, no WhatsApp subtitle), numbers unchanged", () => {
  const shell = read("guest/js/guest-shell.js");
  const frShell = shell.slice(0, shell.indexOf("var GUEST_SHELL_EN"));
  const home = read("guest/index.html");
  const frHome = home.slice(home.indexOf('<dialog class="contacts-dialog"'), home.indexOf("</dialog>", home.indexOf('<dialog class="contacts-dialog"')));
  assert.ok(frHome.length > 1000, "home contacts sheet found");
  const numbers = ["+212 661 147 610", "+212 661 775 422", "150", "190", "177", "141", "+212 606 088 088", "+212 524 443 724", "+212 524 422 446"];
  for (const [name, fr] of [["guest-shell.js (FR)", frShell], ["guest/index.html", frHome]]) {
    assert.doesNotMatch(fr, /depuis un fixe/, name);
    assert.doesNotMatch(fr, /wa-label/, name);
    assert.doesNotMatch(fr, /has-alt|class="alt"/, name);
    assert.match(fr, />Mehdi<\/span>/, name);
    assert.match(fr, />Hicham<\/span>/, name);
    const shown = [...fr.matchAll(/<span class="num"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(shown, numbers, name);
  }
});
